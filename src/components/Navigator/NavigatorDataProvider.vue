<!--
  This source file is part of the Swift.org open source project

  Copyright (c) 2022 Apple Inc. and the Swift project authors
  Licensed under Apache License v2.0 with Runtime Library Exception

  See https://swift.org/LICENSE.txt for license information
  See https://swift.org/CONTRIBUTORS.txt for Swift project authors
-->

<script>
import { fetchIndexPathsData, fetchMetadatav2 } from 'docc-render/utils/data';
import { fetchMetafromTheme } from 'docc-render/utils/theme-settings';
import Language from 'docc-render/constants/Language';
import { patchToVersion } from 'docc-render/utils/version-patch';
import DocumentationTopicStore from 'docc-render/stores/DocumentationTopicStore';

/**
 * Fetches the sidebar navigator data and provides it via a scoped slot,
 * extracting for current language
 */
export default {
  name: 'NavigatorDataProvider',
  props: {
    interfaceLanguage: {
      type: String,
      default: Language.swift.key.url,
    },
    technology: {
      type: Object,
      required: true,
    },
    apiChangesVersion: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      isFetching: false,
      errorFetching: false,
      isFetchingAPIChanges: false,
      navigationIndex: {
        [Language.swift.key.url]: [],
      },
      diffs: null,
      allIndexData: null,
      metadata: null,
      metadatainTheme: null,
    };
  },
  computed: {
    technologyPath: ({ technology }) => {
      // regex should match only the first section, no slash - `/documentation/:technology`
      const matches = /(\/documentation\/(?:[^/]+))\/?/.exec(technology.url);
      return matches ? matches[1] : '';
    },
    versionedNavigationIndex() {
      const { interfaceLanguages } = patchToVersion(DocumentationTopicStore.state.preferredVersion,
        this.allIndexData) || {};
      const preFreezedNav = interfaceLanguages || this.navigationIndex;
      return Object.freeze(preFreezedNav);
    },
    /**
     * Extracts the technology data, for the currently chosen language
     * @return {Object}
     */
    technologyWithChildren({ versionedNavigationIndex, interfaceLanguage, technologyPath }) {
      // get the technologies for the current language
      // eslint-disable-next-line max-len
      let currentLangTechnologies = versionedNavigationIndex[interfaceLanguage] || [];
      // if no such items, we use the default swift one
      if (!currentLangTechnologies.length) {
        currentLangTechnologies = versionedNavigationIndex[Language.swift.key.url] || [];
      }
      // find the current technology
      return currentLangTechnologies.find(t => (
        technologyPath.toLowerCase() === t.path.toLowerCase()
      ));
    },
  },
  created() {
    this.fetchIndexData();
  },
  methods: {
    async fetchIndexData() {
      try {
        this.isFetching = true;
        this.allIndexData = await fetchIndexPathsData();
        this.metadata = await fetchMetadatav2();
        this.metadatainTheme = fetchMetafromTheme();
        // {interfaceLanguages} = this.versionedNavigationIndex
        // TODO: Why did Dobri use a freze?
        // this.navigationIndex = Object.freeze(interfaceLanguages);
      } catch (e) {
        this.errorFetching = true;
      } finally {
        this.isFetching = false;
      }
    },
  },
  render() {
    return this.$scopedSlots.default({
      technology: this.technologyWithChildren,
      isFetching: this.isFetching,
      errorFetching: this.errorFetching,
      isFetchingAPIChanges: this.isFetchingAPIChanges,
      apiChanges: this.diffs,
    });
  },
};
</script>
