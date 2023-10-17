<!--
  This source file is part of the Swift.org open source project

  Copyright (c) 2021-2023 Apple Inc. and the Swift project authors
  Licensed under Apache License v2.0 with Runtime Library Exception

  See https://swift.org/LICENSE.txt for license information
  See https://swift.org/CONTRIBUTORS.txt for Swift project authors
-->

<template>
  <div
    class="declaration-group"
    :class="classes"
    ref="apiChangesDiff"
  >
    <p v-if="shouldCaption" class="platforms">
      <strong>{{ caption }}</strong>
    </p>
    <Source
      v-if="!!!otherDeclarations || isVisible
        || declaration.identifier === selectedIdentifier"
      :tokens="declaration.tokens"
      :language="interfaceLanguage"
      :class="{ 'selected-overload': isVisible
        ? declaration.identifier === selectedIdentifier : true }"
    />
    <!-- FIXME: if overload is collapsed, no outline -->

    <div
      class="overloaded-declaration-group"
      :class="classes"
    >
      <button
        v-for="declaration in otherDeclarations"
        :key="declaration.identifier"
        class="overload-declaration"
        @click="handleSelectOverload(declaration.identifier)"
      >
        <transition-expand>
          <Source
            v-if="isVisible || declaration.identifier === selectedIdentifier"
            :tokens="declaration.tokens"
            :language="interfaceLanguage"
            :class="{ 'selected-overload': isVisible
              && declaration.identifier === selectedIdentifier }"
          />
        </transition-expand>
      </button>
    </div>
  </div>
</template>

<script>
import DeclarationSource from 'docc-render/components/DocumentationTopic/PrimaryContent/DeclarationSource.vue';
import Language from 'docc-render/constants/Language';
import TransitionExpand from 'docc-render/components/TransitionExpand.vue';
import { APIChangesMultipleLines } from 'docc-render/mixins/apiChangesHelpers';

/**
 * Renders a code source with an optional caption.
 */
export default {
  name: 'DeclarationGroup',
  components: {
    Source: DeclarationSource,
    TransitionExpand,
  },
  mixins: [APIChangesMultipleLines],
  inject: {
    languages: {
      default: () => new Set(),
    },
    interfaceLanguage: {
      default: () => Language.swift.key.api,
    },
    symbolKind: {
      default: () => undefined,
    },
    store: {
      default: () => ({
        state: {
          references: {},
        },
      }),
    },
    identifier: {
      default: () => undefined,
    },
  },
  data() {
    return {
      selectedIdentifier: this.identifier,
    };
  },
  props: {
    declaration: {
      type: Object,
      required: true,
    },
    /**
     * Whether to show the caption or not.
     * Usually if there is more than Declaration group.
     */
    shouldCaption: {
      type: Boolean,
      default: false,
    },
    /**
     * The type of code change.
     * @type {"added"|"deprecated"|"modified"}
     */
    changeType: {
      type: String,
      required: false,
    },
    expandDeclarationOverloads: {
      type: Boolean,
      // required: true,
      default: false, // FIXME: Change this
    },
  },
  computed: {
    classes: ({ changeType, multipleLinesClass, displaysMultipleLinesAfterAPIChanges }) => ({
      [`declaration-group--changed declaration-group--${changeType}`]: changeType,
      [multipleLinesClass]: displaysMultipleLinesAfterAPIChanges,
    }),
    caption() {
      return this.declaration.platforms.join(', ');
    },
    isSwift: ({ interfaceLanguage }) => interfaceLanguage === Language.swift.key.api,
    otherDeclarations: ({ declaration }) => declaration.otherDeclarations || null,
    references: ({ store }) => store.state.references,
    isVisible: {
      get: ({ expandDeclarationOverloads }) => expandDeclarationOverloads,
      set(value) {
        this.$emit('update:expandDeclarationOverloads', value);
      },
    },
  },
  methods: {
    async handleSelectOverload(identifier) {
      this.selectedIdentifier = identifier;
      this.isVisible = false; // collapse the overloads
      // await animation finishes
      setTimeout(() => {
        this.$router.push(this.references[identifier].url);
      }, 500);
    },
  },
};
</script>

<style scoped lang="scss">
@import 'docc-render/styles/_core.scss';

.platforms {
  @include font-styles(body-reduced);

  margin-bottom: 0.45rem;
  margin-top: var(--spacing-stacked-margin-xlarge);

  .changed & {
    padding-left: $code-source-spacing;
  }

  &:first-of-type {
    margin-top: 1rem;
  }
}

// show "selected" declaration style
:deep() {
  .selected-overload {
    border-color: var(--color-focus-border-color, var(--color-focus-border-color));
    background: var(--background, var(--color-code-background));
  }
}

button {
  width: 100%;
}

.overload-declaration {
  text-decoration: none;
}

.source {
  margin: var(--declaration-code-listing-margin);

  .platforms + & {
    margin: 0;
  }
}

@include changedStyles {
  &.declaration-group {
    background: var(--background, var(--color-code-background));
  }
  .source {
    background: none;
    border: none;
    margin-top: 0;
    margin-bottom: 0;
    margin-left: $change-icon-occupied-space;
    padding-left: 0;
  }
}
</style>
