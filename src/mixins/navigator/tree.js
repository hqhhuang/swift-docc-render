/**
 * This source file is part of the Swift.org open source project
 *
 * Copyright (c) 2024 Apple Inc. and the Swift project authors
 * Licensed under Apache License v2.0 with Runtime Library Exception
 *
 * See https://swift.org/LICENSE.txt for license information
 * See https://swift.org/CONTRIBUTORS.txt for Swift project authors
*/
/* eslint-disable prefer-destructuring,no-continue,no-param-reassign,no-restricted-syntax */
import { clone } from 'docc-render/utils/data';
import { waitFrames, waitFor } from 'docc-render/utils/loading';
import debounce from 'docc-render/utils/debounce';
import { sessionStorage } from 'docc-render/utils/storage';
import { INDEX_ROOT_KEY, SIDEBAR_ITEM_SIZE } from 'docc-render/constants/sidebar';
import { safeHighlightPattern } from 'docc-render/utils/search-utils';
import { TopicTypes } from 'docc-render/constants/TopicTypes';
import { FILTER_TAGS, CHANGES_TAGS } from 'docc-render/constants/Tags';
import { isEqual, last } from 'docc-render/utils/arrays';
import {
  convertChildrenArrayToObject,
  getAllChildren,
  getChildren,
  getParents,
  getSiblings,
} from 'docc-render/utils/navigatorData';

const STORAGE_KEY = 'navigator.state';

const NO_RESULTS = 'navigator.no-results';
const NO_CHILDREN = 'navigator.no-children';
const ERROR_FETCHING = 'navigator.error-fetching';
const ITEMS_FOUND = 'navigator.items-found';

export default {
  constants: {
    STORAGE_KEY,
    ERROR_FETCHING,
    ITEMS_FOUND,
  },
  // mixins: [
  //   filteredChildrenMixin,
  // ],
  computed: {
    politeAriaLive() {
      const { hasNodes, nodesToRender } = this;
      if (!hasNodes) return '';
      return this.$tc(ITEMS_FOUND, nodesToRender.length, { number: nodesToRender.length });
    },
    assertiveAriaLive: ({
      hasNodes, hasFilter, errorFetching,
    }) => {
      if (hasNodes) return '';
      if (hasFilter) return NO_RESULTS;
      if (errorFetching) return ERROR_FETCHING;
      return NO_CHILDREN;
    },
    filterPattern: ({ debouncedFilter }) => (!debouncedFilter
      ? null
      // remove the `g` for global, as that causes bugs when matching
      : new RegExp(safeHighlightPattern(debouncedFilter), 'i')),
    /**
     * Return the item size for the Scroller element.
     */
    itemSize: () => SIDEBAR_ITEM_SIZE,
    /**
     * Generates a map of the children, with the uid as the key.
     * @return {Object.<string, NavigatorFlatItem>}
     */
    childrenMap({ children }) {
      return convertChildrenArrayToObject(children);
    },
    /**
     * Returns an array of {NavigatorFlatItem}, from the current active UUID
     * @return NavigatorFlatItem[]
     */
    activePathChildren({ activeUID, childrenMap }) {
      // if we have an activeUID and its not stale by any chance, fetch its parents
      return activeUID && childrenMap[activeUID]
        ? getParents(activeUID, childrenMap)
        : [];
    },
    activePathMap: ({ activePathChildren }) => (
      Object.fromEntries(activePathChildren.map(({ uid }) => [uid, true]))
    ),
    activeIndex: ({ activeUID, nodesToRender }) => (
      nodesToRender.findIndex(node => node.uid === activeUID)
    ),
    /**
     * This generates a map of all the nodes we are allowed to render at a certain time.
     * This is used on both toggling, as well as on navigation and filtering.
     * @return {Object.<string, NavigatorFlatItem>}
     */
    renderableChildNodesMap({
      hasFilter, childrenMap, deprecatedHidden, filteredChildren, removeDeprecated,
    }) {
      if (!hasFilter) return childrenMap;

      const childrenLength = filteredChildren.length - 1;
      const filteredChildrenUpToRootSet = new Set([]);
      // iterate backwards
      for (let i = childrenLength; i >= 0; i -= 1) {
        // get item
        const child = filteredChildren[i];
        const groupMarker = childrenMap[child.groupMarkerUID];
        if (groupMarker) {
          filteredChildrenUpToRootSet.add(groupMarker);
        }
        // check if item is already added to list,
        // if yes, continue with next item, as this one is probably a parent of a prev match.
        if (filteredChildrenUpToRootSet.has(child)) continue;

        // if the current item's parent is already in the list, and its not a GroupMarker
        // a sibling already did the heavy work, so we just add it and continue.
        if (
          filteredChildrenUpToRootSet.has(childrenMap[child.parent])
          && child.type !== TopicTypes.groupMarker
        ) {
          filteredChildrenUpToRootSet.add(child);
          continue;
        }
        let allChildren = [];
        // check if it has children. This is for Parents and GroupMarkers
        if (child.childUIDs.length) {
          //   if yes, add them all, so we can expand to see them
          allChildren = removeDeprecated(
            getAllChildren(child.uid, childrenMap), deprecatedHidden,
          );
        }
        // add item and all of it's parents + closest group marker
        allChildren
          .concat(getParents(child.uid, childrenMap))
          .forEach(v => filteredChildrenUpToRootSet.add(v));
      }
      return convertChildrenArrayToObject([...filteredChildrenUpToRootSet]);
    },
    /**
     * Creates a computed for the items, that the openNodes calc depends on
     */
    nodeChangeDeps: ({
      filteredChildren, activePathChildren, debouncedFilter, selectedTags,
    }) => ([
      filteredChildren,
      activePathChildren,
      debouncedFilter,
      selectedTags,
    ]),
    // determine if we should use the filtered items for rendering nodes
    hasFilter({ debouncedFilter, selectedTags, apiChanges }) {
      return Boolean(debouncedFilter.length || selectedTags.length || apiChanges);
    },
    /**
     * Determine if "Hide Deprecated" tag is selected.
     * If we enable multiple tags, this should be an include instead.
     * @returns boolean
     */
    deprecatedHidden: ({ selectedTags }) => (
      selectedTags[0] === FILTER_TAGS.hideDeprecated
    ),
    apiChangesObject() {
      return this.apiChanges || {};
    },
    hasNodes: ({ nodesToRender }) => !!nodesToRender.length,
    totalItemsToNavigate: ({ nodesToRender }) => nodesToRender.length,
    lastActivePathItem: ({ activePath }) => last(activePath),
  },
  created() {
    this.restorePersistedState();
  },
  watch: {
    filter: 'debounceInput',
    nodeChangeDeps: 'trackOpenNodes',
    activePath: 'handleActivePathChange',
    apiChanges(value) {
      if (value) return;
      // if we remove APIChanges, remove all related tags as well
      this.selectedTags = this.selectedTags.filter(t => !Object.values(CHANGES_TAGS).includes(t));
    },
    async activeUID(newUid, oldUID) {
      // Update the dynamicScroller item's size, when we change the UID,
      // to fix cases where applying styling that changes
      // the size of active items.
      await this.$nextTick();
      const item = this.$refs[`dynamicScroller_${oldUID}`];
      if (item && item.updateSize) {
        // call the `updateSize` method on the `DynamicScrollerItem`, since it wont get triggered,
        // on its own from changing the active item.
        item.updateSize();
      }
    },
  },
  methods: {
    setUnlessEqual(property, data) {
      if (isEqual(data, this[property])) return;

      this[property] = Object.freeze(data);
    },
    toggleAllNodes() {
      const parentNodes = this.children.filter(child => child.parent === INDEX_ROOT_KEY
        && child.type !== TopicTypes.groupMarker && child.childUIDs.length);
      // make sure all nodes get either open or close
      this.allNodesToggled = !this.allNodesToggled;
      if (this.allNodesToggled) {
        this.openNodes = {};
        this.generateNodesToRender();
      }

      parentNodes.forEach((node) => {
        this.toggleFullTree(node);
      });
    },
    clearFilters() {
      this.filter = '';
      this.debouncedFilter = '';
      this.selectedTags = [];
    },
    scrollToFocus() {
      this.$refs.scroller.scrollToItem(this.focusedIndex);
    },
    debounceInput: debounce(function debounceInput(value) {
      // store the new filter value
      this.debouncedFilter = value;
      // reset the last focus target
      this.lastFocusTarget = null;
    }, 200),
    /**
     * Finds which nodes need to be opened.
     * Initiates a watcher, that reacts to filtering and page navigation.
     */
    trackOpenNodes(
      [filteredChildren, activePathChildren, filter, selectedTags],
      [, activePathChildrenBefore = [], filterBefore = '', selectedTagsBefore = []] = [],
    ) {
      // skip in case this is a first mount and we are syncing the `filter` and `selectedTags`.
      if (
        (filter !== filterBefore && !filterBefore && this.getFromStorage('filter'))
        || (
          !isEqual(selectedTags, selectedTagsBefore)
          && !selectedTagsBefore.length
          && this.getFromStorage('selectedTags', []).length
        )
      ) {
        return;
      }

      // if the activePath items change, we navigated to another page
      const pageChange = !isEqual(activePathChildrenBefore, activePathChildren);
      // store the childrenMap into a var, so we dont register multiple deps to it
      const { childrenMap } = this;
      // decide which items are open
      // if "Hide Deprecated" is picked, there is no filter,
      // or navigate to page while filtering, we open the items leading to the activeUID
      let nodes = activePathChildren;

      if (!((this.deprecatedHidden && !this.debouncedFilter.length)
        || (pageChange && this.hasFilter)
        || !this.hasFilter)) {
        const nodesSet = new Set();
        // gather all the parents of all the matches.
        // we do this in reverse, so deep children do all the work.
        const len = filteredChildren.length - 1;
        for (let i = len; i >= 0; i -= 1) {
          const child = filteredChildren[i];
          // check if the parent or the child itself is already gathered
          if (nodesSet.has(childrenMap[child.parent]) || nodesSet.has(child)) {
            // if so, just skip iterating over them
            continue;
          }
          // otherwise gather all the parents excluding the child itself, and add to the set
          getParents(child.uid, childrenMap)
            .slice(0, -1)
            .forEach(c => nodesSet.add(c));
        }
        // dump the set into the nodes array
        nodes = [...nodesSet];
      }
      // if we navigate across pages, persist the previously open nodes
      const nodesToStartFrom = pageChange ? { ...this.openNodes } : {};
      // generate a new list of open nodes
      const newNodes = nodes.reduce((all, current) => {
        all[current.uid] = true;
        return all;
      }, nodesToStartFrom);
      this.setUnlessEqual('openNodes', newNodes);

      // merge in the new open nodes with the base nodes
      this.generateNodesToRender();
      // update the focus index, based on the activeUID
      this.updateFocusIndexExternally();
    },
    /**
     * Toggle a node open/close
     * @param {NavigatorFlatItem} node
     */
    toggle(node) {
      // check if the item is open
      const isOpen = this.openNodes[node.uid];
      let include = [];
      let exclude = [];
      // if open, we need to close it
      if (isOpen) {
        // clone the open nodes map
        const openNodes = clone(this.openNodes);
        // remove current node and all of it's children, from the open list
        const allChildren = getAllChildren(node.uid, this.childrenMap);
        allChildren.forEach(({ uid }) => {
          delete openNodes[uid];
        });
        // set the new open nodes. Should be faster than iterating each and calling `this.$delete`.
        this.setUnlessEqual('openNodes', openNodes);
        // exclude all items, but the first
        exclude = allChildren.slice(1);
      } else {
        this.setUnlessEqual('openNodes', { ...this.openNodes, [node.uid]: true });
        // include all childUIDs to get opened
        include = getChildren(node.uid, this.childrenMap, this.children)
          .filter(child => this.renderableChildNodesMap[child.uid]);
      }
      this.augmentRenderNodes({ uid: node.uid, include, exclude });
    },
    /**
     * Handle toggling the entire tree open/close, using alt + click
     */
    toggleFullTree(node) {
      const isOpen = this.openNodes[node.uid];
      const openNodes = clone(this.openNodes);
      const allChildren = getAllChildren(node.uid, this.childrenMap);
      let exclude = [];
      let include = [];
      allChildren.forEach(({ uid }) => {
        if (isOpen) {
          delete openNodes[uid];
        } else {
          openNodes[uid] = true;
        }
      });

      // figure out which items to include and exclude
      if (isOpen) {
        exclude = allChildren.slice(1);
      } else {
        include = allChildren.slice(1).filter(child => this.renderableChildNodesMap[child.uid]);
      }
      this.setUnlessEqual('openNodes', openNodes);
      this.augmentRenderNodes({ uid: node.uid, exclude, include });
    },
    toggleSiblings(node) {
      const isOpen = this.openNodes[node.uid];
      const openNodes = clone(this.openNodes);
      const siblings = getSiblings(node.uid, this.childrenMap, this.children);
      siblings.forEach(({ uid, childUIDs, type }) => {
        // if the item has no children or is a groupMarker, exit early
        if (!childUIDs.length || type === TopicTypes.groupMarker) return;
        if (isOpen) {
          const children = getAllChildren(uid, this.childrenMap);
          // remove all children
          children.forEach((child) => {
            delete openNodes[child.uid];
          });
          // remove the sibling as well
          delete openNodes[uid];
          // augment the nodesToRender
          this.augmentRenderNodes({ uid, exclude: children.slice(1), include: [] });
        } else {
          // add it
          openNodes[uid] = true;
          const children = getChildren(uid, this.childrenMap, this.children)
            .filter(child => this.renderableChildNodesMap[child.uid]);
          // augment the nodesToRender
          this.augmentRenderNodes({ uid, exclude: [], include: children });
        }
      });
      this.setUnlessEqual('openNodes', openNodes);
      // persist all the open nodes, as we change the openNodes after the node augment runs
      this.persistState();
    },
    /**
     * Removes deprecated items from a list
     * @param {NavigatorFlatItem[]} items
     * @param {boolean} deprecatedHidden
     * @returns {NavigatorFlatItem[]}
     */
    removeDeprecated(items, deprecatedHidden) {
      if (!deprecatedHidden) return items;
      return items.filter(({ deprecated }) => !deprecated);
    },
    /**
     * Stores all the nodes we should render at this point.
     * This gets called everytime you open/close a node,
     * or when you start filtering.
     * @return void
     */
    generateNodesToRender() {
      const { children, openNodes, renderableChildNodesMap } = this;

      // create a set of all matches and their parents
      // generate the list of nodes to render
      this.setUnlessEqual('nodesToRender', children
        .filter(child => (
          // make sure the item can be rendered
          renderableChildNodesMap[child.uid]
          // and either its parent is open, or its a root item
          && (child.parent === INDEX_ROOT_KEY || openNodes[child.parent])
        )));
      // persist all the open nodes
      this.persistState();
      // wait a frame, so the scroller is ready, `nextTick` is not enough.
      this.scrollToElement();
    },
    /**
     * Augments the nodesToRender, by injecting or removing items.
     * Used mainly to toggle items on/off
     */
    augmentRenderNodes({ uid, include = [], exclude = [] }) {
      const index = this.nodesToRender.findIndex(n => n.uid === uid);
      // decide if should remove or add
      if (include.length) {
        // remove duplicates
        const duplicatesRemoved = include.filter(i => !this.nodesToRender.includes(i));
        // clone the nodes
        const clonedNodes = this.nodesToRender.slice(0);
        // inject the nodes at the index
        clonedNodes.splice(index + 1, 0, ...duplicatesRemoved);
        this.setUnlessEqual('nodesToRender', clonedNodes);
      } else if (exclude.length) {
        // if remove, filter out those items
        const excludeSet = new Set(exclude);
        this.setUnlessEqual('nodesToRender', this.nodesToRender.filter(item => !excludeSet.has(item)));
      }
      this.persistState();
    },
    /**
     * Get items from PersistedStorage, for the current technology.
     * Can fetch a specific `key` or the entire state.
     * @param {string} [key] - key to fetch
     * @param {*} [fallback] - fallback property, if `key is not found`
     * @return *
     */
    getFromStorage(key, fallback = null) {
      const state = sessionStorage.get(STORAGE_KEY, {});
      const technologyState = state[this.technologyPath];
      if (!technologyState) return fallback;
      if (key) {
        return technologyState[key] || fallback;
      }
      return technologyState;
    },
    /**
     * Persists the current state, so its not lost if you refresh or navigate away
     */
    persistState() {
      // fallback to using the activePath items
      const fallback = { path: this.lastActivePathItem };
      // try to get the `path` for the current activeUID
      const { path } = this.activeUID
        ? (this.childrenMap[this.activeUID] || fallback)
        : fallback;
      const technologyState = {
        technology: this.technology,
        // find the path buy the activeUID, because the lastActivePath wont be updated at this point
        path,
        hasApiChanges: !!this.apiChanges,
        // store the keys of the openNodes map, converting to number, to reduce space
        openNodes: Object.keys(this.openNodes).map(Number),
        // we need only the UIDs
        nodesToRender: this.nodesToRender.map(({ uid }) => uid),
        activeUID: this.activeUID,
        filter: this.filter,
        selectedTags: this.selectedTags,
      };
      const state = {
        ...sessionStorage.get(STORAGE_KEY, {}),
        [this.technologyPath]: technologyState,
      };
      sessionStorage.set(STORAGE_KEY, state);
    },
    clearPersistedState() {
      const state = {
        ...sessionStorage.get(STORAGE_KEY, {}),
        [this.technologyPath]: {},
      };
      sessionStorage.set(STORAGE_KEY, state);
    },
    /**
     * Restores the persisted state from sessionStorage. Called on `create` hook.
     */
    restorePersistedState() {
      // get the entire state for the technology
      const persistedState = this.getFromStorage();
      // if there is no state or it's last path is not the same, clear the storage
      if (!persistedState || persistedState.path !== this.lastActivePathItem) {
        this.clearPersistedState();
        this.handleActivePathChange(this.activePath);
        return;
      }
      const {
        technology,
        nodesToRender = [],
        filter = '',
        hasAPIChanges = false,
        activeUID = null,
        selectedTags = [],
        openNodes,
      } = persistedState;
      // if for some reason there are no nodes and no filter, we can assume its bad cache
      if (!nodesToRender.length && !filter && !selectedTags.length) {
        // clear the sessionStorage before continuing
        this.clearPersistedState();
        this.handleActivePathChange(this.activePath);
        return;
      }
      const { childrenMap } = this;
      // make sure all nodes exist in the childrenMap
      const allNodesMatch = nodesToRender.every(uid => childrenMap[uid]);
      // check if activeUID node matches the current page path
      const activeUIDMatchesCurrentPath = activeUID
        ? ((this.childrenMap[activeUID] || {}).path === this.lastActivePathItem)
        : this.activePath.length === 1;
      // take a second pass at validating data
      if (
        // if the technology is different
        technology !== this.technology
        // if not all nodes to render match the ones we have
        || !allNodesMatch
        // if API the existence of apiChanges differs
        || (hasAPIChanges !== Boolean(this.apiChanges))
        || !activeUIDMatchesCurrentPath
        // if there is an activeUID and its not in the nodesToRender
        || (activeUID && !filter && !selectedTags.length && !nodesToRender.includes(activeUID))
      ) {
        // clear the sessionStorage before continuing
        this.clearPersistedState();
        this.handleActivePathChange(this.activePath);
        return;
      }
      // create the openNodes map
      this.setUnlessEqual('openNodes', Object.fromEntries(openNodes.map(n => [n, true])));
      // get all the nodes to render
      // generate the array of flat children objects to render
      this.setUnlessEqual('nodesToRender', nodesToRender.map(uid => childrenMap[uid]));
      // finally fetch any previously assigned filters or tags
      this.selectedTags = selectedTags;
      this.filter = filter;
      this.debouncedFilter = this.filter;
      this.activeUID = activeUID;
      // scroll to the active element
      this.scrollToElement();
    },
    async scrollToElement() {
      await waitFrames(1);
      if (!this.$refs.scroller) return;
      // check if the current element is visible and needs scrolling into
      const element = document.getElementById(this.activeUID);
      // check if there is such an item AND the item is inside scroller area
      if (element && this.getChildPositionInScroller(element) === 0) return;
      // find the index of the current active UID in the nodes to render
      const index = this.nodesToRender.findIndex(child => child.uid === this.activeUID);
      // check if the item is currently not rendered
      if (index === -1) {
        // if we are filtering, it makes more sense to scroll to top of list
        if (this.hasFilter && !this.deprecatedHidden) {
          this.$refs.scroller.scrollToItem(0);
        }
        return;
      }
      // check if the element is visible
      // call the scroll method on the `scroller` component.
      this.$refs.scroller.scrollToItem(index);
    },
    /**
     * Determine where a child element is positioned, inside the scroller container.
     * returns -1, if above the viewport
     * returns 0, if inside the viewport
     * returns 1, if below the viewport
     *
     * @param {HTMLAnchorElement} element - child element
     * @return Number
     */
    getChildPositionInScroller(element) {
      if (!element) return 0;
      const { paddingTop, paddingBottom } = getComputedStyle(this.$refs.scroller.$el);
      // offset for better visibility
      const offset = {
        top: parseInt(paddingTop, 10) || 0,
        bottom: parseInt(paddingBottom, 10) || 0,
      };
      // get the position of the scroller in the screen
      const { y: areaY, height: areaHeight } = this.$refs.scroller.$el.getBoundingClientRect();
      // get the position of the active element
      const { y: elY } = element.getBoundingClientRect();
      let elHeight = 0;
      // get height from parent element if it's displayed
      if (element.offsetParent) {
        elHeight = element.offsetParent.offsetHeight;
      }
      // calculate where element starts from
      const elementStart = elY - areaY - offset.top;
      // element is above the scrollarea
      if (elementStart < 0) {
        return -1;
      }
      // element ends below the scrollarea
      if ((elementStart + elHeight) >= (areaHeight - offset.bottom)) {
        return 1;
      }
      // element is inside the scrollarea
      return 0;
    },
    isInsideScroller(element) {
      if (!this.$refs.scroller) return false;
      return this.$refs.scroller.$el.contains(element);
    },
    handleFocusIn({ target }) {
      this.lastFocusTarget = target;
      const positionIndex = this.getChildPositionInScroller(target);
      // if multiplier is 0, the item is inside the scrollarea, no need to scroll
      if (positionIndex === 0) return;
      // get the height of the closest positioned item.
      const { offsetHeight } = target.offsetParent;
      // scroll the area, up/down, based on position of child item
      this.$refs.scroller.$el.scrollBy({
        top: offsetHeight * positionIndex,
        left: 0,
      });
    },
    handleFocusOut(event) {
      if (!event.relatedTarget) return;
      // reset the `lastFocusTarget`, if the focsOut target is not in the scroller
      if (!this.isInsideScroller(event.relatedTarget)) {
        this.lastFocusTarget = null;
      }
    },
    handleScrollerUpdate: debounce(async function handleScrollerUpdate() {
      // wait is long, because the focus change is coming in very late
      await waitFor(300);
      if (
        !this.lastFocusTarget
        // check if the lastFocusTarget is inside the scroller. (can happen if we scroll to fast)
        || !this.isInsideScroller(this.lastFocusTarget)
        // check if the activeElement is identical to the lastFocusTarget
        || document.activeElement === this.lastFocusTarget
      ) {
        return;
      }
      this.lastFocusTarget.focus({
        preventScroll: true,
      });
    }, 50),
    /**
     * Stores the newly clicked item's UID, so we can highlight it
     */
    setActiveUID(uid) {
      this.activeUID = uid;
    },
    /**
     * Handles the `navigate` event from NavigatorCardItem, guarding from selecting an item,
     * that points to another technology.
     */
    handleNavigationChange(uid) {
      const path = this.childrenMap[uid].path;
      // if the path is outside of this technology tree, dont store the uid
      if (path.startsWith(this.technologyPath)) {
        this.setActiveUID(uid);
        this.$emit('navigate', path);
      }
    },
    /**
     * Returns an array of {NavigatorFlatItem}, from a breadcrumbs list
     * @return NavigatorFlatItem[]
     */
    pathsToFlatChildren(paths) {
      // get the stack to iterate
      const stack = paths.slice(0).reverse();
      const { childrenMap } = this;
      // the items to loop over. First iteration is over all items
      let childrenStack = this.children;
      const result = [];
      // loop as long as there are items
      while (stack.length) {
        // get the last item (first parent, as we reversed it)
        const currentPath = stack.pop();
        // find it by path (we dont have the UID yet)
        const currentNode = childrenStack.find(c => c.path === currentPath);
        if (!currentNode) break;
        // push the object to the results
        result.push(currentNode);
        if (stack.length) {
          // get the children, so we search in those
          childrenStack = currentNode.childUIDs.map(c => childrenMap[c]);
        }
      }
      return result;
    },
    handleActivePathChange(activePath) {
      // get current active item's node, if any
      const currentActiveItem = this.childrenMap[this.activeUID];
      // get the current path
      const lastActivePathItem = last(activePath);
      // check if there is an active item to start looking from
      if (currentActiveItem) {
        // Return early, if the current path matches the current active node.
        // This will happen on each navigator item click, as the activePath gets updated after
        // the navigation ends and RenderJSON is updated.
        if (lastActivePathItem === currentActiveItem.path) {
          return;
        }
        // Get the surrounding items
        const siblings = getSiblings(this.activeUID, this.childrenMap, this.children);
        const children = getChildren(this.activeUID, this.childrenMap, this.children);
        const parents = getParents(this.activeUID, this.childrenMap);
        // try to match if any of the `siblings`,`children` or any of the `parents`,
        // match the current open item
        const matchingItem = [...children, ...siblings, ...parents]
          .find(child => child.path === lastActivePathItem);

        // set the match as an active item
        if (matchingItem) {
          this.setActiveUID(matchingItem.uid);
          return;
        }
      }
      // There is no match to base upon, so we need to search
      // across the activePath for the active item.
      const activePathChildren = this.pathsToFlatChildren(activePath);
      // if there are items, set the new active UID
      if (activePathChildren.length) {
        this.setActiveUID(activePathChildren[activePathChildren.length - 1].uid);
        return;
      }
      // if there is an activeUID, unset it, as we probably navigated back to the root
      if (this.activeUID) {
        this.setActiveUID(null);
        return;
      }
      // Just track the open nodes, as setting the activeUID as null wont do anything.
      this.trackOpenNodes(this.nodeChangeDeps);
    },
    /**
     * Updates the current focusIndex, based on where the activeUID is.
     * If not in the rendered items, we set it to 0.
     */
    updateFocusIndexExternally() {
      // specify we changed the focus externally, not by using tabbing or up/down
      this.externalFocusChange = true;
      // if the activeUID is rendered, store it's index
      if (this.activeIndex > 0) {
        this.focusIndex(this.activeIndex);
      } else {
        // if there is no active item, or we cant see it, return the index to 0
        this.focusIndex(0);
      }
    },
    /**
     * Focuses the parent of a child node.
     * @param {NavigatorFlatItem} item
     */
    focusNodeParent(item) {
      const parent = this.childrenMap[item.parent];
      if (!parent) return;
      const parentIndex = this.nodesToRender.findIndex(c => c.uid === parent.uid);
      if (parentIndex === -1) return;
      // we perform an intentional focus change, so no need to set `externalFocusChange` to `true`
      this.focusIndex(parentIndex);
    },
  },
};
