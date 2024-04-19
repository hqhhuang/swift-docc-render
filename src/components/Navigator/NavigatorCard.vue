<!--
  This source file is part of the Swift.org open source project

  Copyright (c) 2022-2024 Apple Inc. and the Swift project authors
  Licensed under Apache License v2.0 with Runtime Library Exception

  See https://swift.org/LICENSE.txt for license information
  See https://swift.org/CONTRIBUTORS.txt for Swift project authors
-->

<template>
  <BaseNavigatorCard
    :class="{ 'filter-on-top': renderFilterOnTop }"
    v-bind="{
      isTechnologyBeta,
      technologyPath,
    }"
    @close="$emit('close')"
  >
    <template #above-navigator-head>
      <slot name="above-navigator-head"/>
    </template>
    <template #navigator-head>
      <slot name="navigator-head"/>
    </template>
    <template #body="{ className }">
      <slot name="post-head" />
      <div
        :class="className"
        @keydown.alt.up.capture.prevent="focusFirst"
        @keydown.alt.down.capture.prevent="focusLast"
        @keydown.up.exact.capture.prevent="focusPrev"
        @keydown.down.exact.capture.prevent="focusNext"
      >
        <Reference
          v-if="technology"
          :id="INDEX_ROOT_KEY"
          :url="technologyPath"
          class="technology-title"
          @click.alt.native.prevent="toggleAllNodes"
        >
          <h2 class="card-link">
            {{ technology }}
          </h2>
          <Badge v-if="isTechnologyBeta" variant="beta" />
        </Reference>
        <DynamicScroller
          v-show="hasNodes"
          :id="scrollLockID"
          ref="scroller"
          class="scroller"
          :aria-label="$t('navigator.title')"
          :items="nodesToRender"
          :min-item-size="itemSize"
          emit-update
          key-field="uid"
          v-slot="{ item, active, index }"
          @focusin.native="handleFocusIn"
          @focusout.native="handleFocusOut"
          @update="handleScrollerUpdate"
          @keydown.alt.up.capture.prevent="focusFirst"
          @keydown.alt.down.capture.prevent="focusLast"
          @keydown.up.exact.capture.prevent="focusPrev"
          @keydown.down.exact.capture.prevent="focusNext"
        >
          <DynamicScrollerItem
            v-bind="{ active, item, dataIndex: index }"
            :ref="`dynamicScroller_${item.uid}`"
          >
            <NavigatorCardItem
              :item="item"
              :isRendered="active"
              :filter-pattern="filterPattern"
              :filter-text="debouncedFilter"
              :is-active="item.uid === activeUID"
              :is-bold="activePathMap[item.uid]"
              :expanded="openNodes[item.uid]"
              :api-change="apiChangesObject[item.path]"
              :isFocused="focusedIndex === index"
              :enableFocus="!externalFocusChange"
              :navigator-references="navigatorReferences"
              @toggle="toggle"
              @toggle-full="toggleFullTree"
              @toggle-siblings="toggleSiblings"
              @navigate="handleNavigationChange"
              @focus-parent="focusNodeParent"
            />
          </DynamicScrollerItem>
        </DynamicScroller>
        <div aria-live="polite" class="visuallyhidden">
          {{ politeAriaLive }}
        </div>
        <div aria-live="assertive" class="no-items-wrapper">
          <p class="no-items">{{ $t(assertiveAriaLive) }}</p>
        </div>
      </div>
      <div class="filter-wrapper" v-if="!errorFetching">
        <div class="navigator-filter">
          <div class="input-wrapper">
            <FilterInput
              v-model="filter"
              :tags="suggestedTags"
              :translatableTags="translatableTags"
              :selected-tags.sync="selectedTags"
              :placeholder="$t('filter.title')"
              :should-keep-open-on-blur="false"
              :shouldTruncateTags="shouldTruncateTags"
              :position-reversed="!renderFilterOnTop"
              class="filter-component"
              @clear="clearFilters"
            />
          </div>
          <slot name="filter" />
        </div>
      </div>
    </template>
  </BaseNavigatorCard>
</template>

<script>
/* eslint-disable prefer-destructuring,no-continue,no-param-reassign,no-restricted-syntax */
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import { INDEX_ROOT_KEY } from 'docc-render/constants/sidebar';
import NavigatorCardItem from 'theme/components/Navigator/NavigatorCardItem.vue';
import BaseNavigatorCard from 'docc-render/components/Navigator/BaseNavigatorCard.vue';
import FilterInput from 'docc-render/components/Filter/FilterInput.vue';
import keyboardNavigation from 'docc-render/mixins/keyboardNavigation';
import filteredChildrenMixin from 'theme/mixins/navigator/filteredChildren';
import tagsProvider from 'theme/mixins/navigator/tagsProvider';
import Reference from 'docc-render/components/ContentNode/Reference.vue';
import Badge from 'docc-render/components/Badge.vue';
import treeHelper from 'docc-render/mixins/navigator/tree';

/**
 * Renders the card for a technology and it's child symbols, in the navigator.
 * For performance reasons, the component uses watchers over computed, so we can more precisely
 * manage when re-calculations and re-rendering is done.
 */
export default {
  name: 'NavigatorCard',
  components: {
    FilterInput,
    NavigatorCardItem,
    DynamicScroller,
    DynamicScrollerItem,
    BaseNavigatorCard,
    Reference,
    Badge,
  },
  props: {
    technologyPath: {
      type: String,
      default: '',
    },
    children: {
      type: Array,
      required: true,
    },
    technology: {
      type: String,
      required: false,
    },
    activePath: {
      type: Array,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    scrollLockID: {
      type: String,
      default: '',
    },
    errorFetching: {
      type: Boolean,
      default: false,
    },
    apiChanges: {
      type: Object,
      default: null,
    },
    isTechnologyBeta: {
      type: Boolean,
      default: false,
    },
    navigatorReferences: {
      type: Object,
      default: () => {},
    },
    renderFilterOnTop: {
      type: Boolean,
      default: false,
    },
    hideAvailableTags: {
      type: Boolean,
      default: false,
    },
  },
  mixins: [
    keyboardNavigation, filteredChildrenMixin, tagsProvider, treeHelper,
  ],
  data() {
    return {
      // value to v-model the filter to
      filter: '',
      // debounced filter value, to reduce the computed property computations. Used in filter logic.
      debouncedFilter: '',
      selectedTags: [],
      /** @type {Object.<string, boolean>} */
      openNodes: Object.freeze({}),
      /** @type {NavigatorFlatItem[]} */
      nodesToRender: Object.freeze([]),
      activeUID: null,
      lastFocusTarget: null,
      allNodesToggled: false,
      INDEX_ROOT_KEY,
    };
  },
};
</script>

<style scoped lang='scss'>
@import 'docc-render/styles/_core.scss';
@import '~vue-virtual-scroller/dist/vue-virtual-scroller.css';

// unfortunately we need to hard-code the filter height
$filter-height: 71px;
$filter-height-small: 60px;
$close-icon-size: 19px;
$technology-title-background: var(--color-fill) !default;
$technology-title-background-active: var(--color-fill-gray-quaternary) !default;
$navigator-card-vertical-spacing: 8px !default;

.navigator-card {
  &.filter-on-top {
    .filter-wrapper {
      order: 1;
      position: static;
    }

    .card-body {
      order: 2;
    }
  }
}

.no-items-wrapper {
  overflow: hidden;
  color: var(--color-figure-gray-tertiary);

  .no-items:not(:empty) {
    @include font-styles(body-reduced);
    padding: var(--card-vertical-spacing) var(--card-horizontal-spacing);
    // make sure the text does not get weirdly cut
    min-width: 200px;
    box-sizing: border-box;
  }
}

.technology-title {
  @include safe-area-left-set(margin-left, var(--card-horizontal-spacing));
  @include safe-area-right-set(margin-right, var(--card-horizontal-spacing));
  padding: $navigator-card-vertical-spacing $nav-card-horizontal-spacing;
  padding-left: $nav-card-horizontal-spacing * 2;
  background: $technology-title-background;
  border-radius: $nano-border-radius;
  display: flex;
  white-space: nowrap;

  @include breakpoint(small, nav) {
    margin-top: 0;
  }

  .card-link {
    color: var(--color-text);
    @include font-styles(label-reduced);
    font-weight: $font-weight-semibold;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &.router-link-exact-active {
    background: $technology-title-background-active;
  }

  &:hover {
    background: var(--color-navigator-item-hover);
    text-decoration: none;
  }
}

.navigator-filter {
  box-sizing: border-box;
  padding: 15px var(--nav-filter-horizontal-padding);
  border-top: $generic-border-style;
  height: $filter-height;
  display: flex;
  align-items: flex-end;

  .filter-on-top & {
    border-top: none;
    align-items: flex-start;
  }

  @include safe-area-left-set(padding-left, var(--nav-filter-horizontal-padding));
  @include safe-area-right-set(padding-right, var(--nav-filter-horizontal-padding));

  @include breakpoint(medium, nav) {
    --nav-filter-horizontal-padding: 20px;
    border: none;
    padding-top: 10px;
    padding-bottom: 10px;
    height: $filter-height-small;
  }

  .input-wrapper {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .filter-component {
    --input-vertical-padding: 8px;
    --input-height: 22px;
    --input-border-color: var(--color-grid);
    --input-text: var(--color-figure-gray-secondary);

    :deep() .filter__input {
      @include font-styles(body);

      &-label::after {
        min-width: 70px;
      }
    }
  }
}

.scroller {
  height: 100%;
  box-sizing: border-box;
  padding-bottom: calc(var(--top-offset, 0px) + var(--card-vertical-spacing));
  transition: padding-bottom ease-in 0.15s;

  @include breakpoint(medium, nav) {
    padding-bottom: $nav-menu-items-ios-bottom-spacing;
  }

  // The VueVirtualScroller scrollbar is not selectable and draggable in Safari,
  // which is most probably caused by the complicated styling of the component.
  // Adding translate3D causes the browser to use hardware acceleration and fixes the issue.
  :deep(.vue-recycle-scroller__item-wrapper) {
    transform: translate3d(0, 0, 0);
  }
}

.filter-wrapper {
  position: sticky;
  bottom: 0;
  background: var(--color-fill);

  .sidebar-transitioning & {
    flex: 1 0 $filter-height;
    overflow: hidden;
    @include breakpoint(medium, nav) {
      flex-basis: $filter-height-small;
    }
  }
}
</style>
