<!--
  This source file is part of the Swift.org open source project

  Copyright (c) 2022 Apple Inc. and the Swift project authors
  Licensed under Apache License v2.0 with Runtime Library Exception

  See https://swift.org/LICENSE.txt for license information
  See https://swift.org/CONTRIBUTORS.txt for Swift project authors
-->

<template>
  <SVGIcon viewBox="0 0 14 14" class="collection-icon">
    <path d="M1.2,8.2A1.21,1.21,0,1,0,0,7,1.21,1.21,0,0,0,1.2,8.2Zm11.93-.33a.87.87,0,0,0,0-1.74H4.87a.87.87,0,0,0,0,1.74Z"/>
    <path d="M1.2,10.85A1.21,1.21,0,1,1,0,12.06,1.21,1.21,0,0,1,1.2,10.85Zm11.93.33a.88.88,0,0,1,0,1.75H4.87a.88.88,0,0,1,0-1.75h8.26Z"/>
    <path d="M1.2.74A1.21,1.21,0,1,1,0,2,1.21,1.21,0,0,1,1.2.74Zm11.93.34A.86.86,0,0,1,14,2a.87.87,0,0,1-.87.87H4.87a.87.87,0,0,1,0-1.74h8.26Z"/>
  </SVGIcon>
</template>

<script>
import SVGIcon from 'docc-render/components/SVGIcon.vue';

export default {
  name: 'CollectionIcon',
  components: { SVGIcon },
};
</script>
