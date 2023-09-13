<!--
  This source file is part of the Swift.org open source project

  Copyright (c) 2022-2023 Apple Inc. and the Swift project authors
  Licensed under Apache License v2.0 with Runtime Library Exception

  See https://swift.org/LICENSE.txt for license information
  See https://swift.org/CONTRIBUTORS.txt for Swift project authors
-->
<template>
  <div class="OnThisPageStickyContainer">
    <slot />
  </div>
</template>

<script>

export default {
  name: 'OnThisPageStickyContainer',
};
</script>

<style scoped lang='scss'>
@import 'docc-render/styles/_core.scss';

.OnThisPageStickyContainer {
  $top: $nav-height + rem(13px);
  margin-top: $contenttable-spacing-single-side;
  margin-bottom: $contenttable-spacing-single-side;
  position: sticky;
  top: $top;
  align-self: flex-start;
  flex: 0 0 auto;
  width: $on-this-page-aside-width;
  margin-right: $nav-padding;
  // padding-right: $nav-padding;
  box-sizing: border-box;
  // padding-bottom: var(--spacing-stacked-margin-small);
  max-height: calc(100vh - #{$top} - 25px);
  overflow: hidden;

  @media print {
    display: none;
  }

  @include breakpoint(small) {
    display: none;
  }

  .OnThisPageNav:not(:only-child) {
    margin-bottom: 15px;
  }

  .doc-topic {
    background: var(--color-fill-secondary);
    height: 100%;
    max-height: 100%;
    border-left: 8px solid var(--color-fill-light-blue-secondary);
  }

  .overflow-link {
    position: absolute;
    content: '';
    width: 100%;
    height: 200px;
    background: linear-gradient(to bottom,
      transparent 10%, white 95%);
    z-index: 42;
    bottom: 0;
    border-left: 8px solid var(--color-fill-light-blue-secondary); // prevent gradient on border
  }

  &:deep(.documentation-hero--disabled) {
    padding-right: unset;
  }
}

</style>
