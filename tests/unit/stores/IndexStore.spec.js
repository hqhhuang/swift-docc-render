/**
 * This source file is part of the Swift.org open source project
 *
 * Copyright (c) 2024 Apple Inc. and the Swift project authors
 * Licensed under Apache License v2.0 with Runtime Library Exception
 *
 * See https://swift.org/LICENSE.txt for license information
 * See https://swift.org/CONTRIBUTORS.txt for Swift project authors
*/

import IndexStore from 'docc-render/stores/IndexStore';

const navigationIndex = {
  interfaceLanguages: {
    swift: [],
    occ: [],
    data: [],
  },
};

const flatChildren = [
  {
    title: 'item 1',
  },
  {
    title: 'item 2',
  },
];

const references = {
  foo: { identifier: 'foo' },
  bar: { identifier: 'bar' },
};

const apiChanges = {
  interfaceLanguages: {
    swift: [],
  },
};

const includedArchiveIdentifiers = ['foo', 'bar'];

describe('IndexStore', () => {
  const defaultState = {
    navigationIndex: {},
    flatChildren: [],
    references: {},
    apiChanges: {},
    includedArchiveIdentifiers: [],
  };

  beforeEach(() => {
    localStorage.clear();
    IndexStore.reset();
  });

  it('has a default state', () => {
    expect(IndexStore.state).toEqual(defaultState);
  });

  describe('reset', () => {
    it('restores the default state', () => {
      IndexStore.state.navigationIndex = navigationIndex;
      IndexStore.state.flatChildren = flatChildren;
      IndexStore.state.references = references;
      IndexStore.state.apiChanges = apiChanges;
      IndexStore.state.includedArchiveIdentifiers = includedArchiveIdentifiers;

      expect(IndexStore.state).not.toEqual(defaultState);
      IndexStore.reset();
      // assert all the state is reset
      expect(IndexStore.state).toEqual(defaultState);
    });
  });

  it('sets navigation index', () => {
    IndexStore.setNavigationIndex(navigationIndex);
    expect(IndexStore.state.navigationIndex).toBe(navigationIndex);
  });

  it('sets `flatChildren`', () => {
    IndexStore.setFlatChildren(flatChildren);
    expect(IndexStore.state.flatChildren).toBe(flatChildren);
  });

  it('sets `references`', () => {
    IndexStore.setReferences(references);
    expect(IndexStore.state.references).toBe(references);
  });

  it('sets `apiChanges`', () => {
    IndexStore.setApiChanges(apiChanges);
    expect(IndexStore.state.apiChanges).toBe(apiChanges);
  });

  it('sets `includedArchiveIdentifiers`', () => {
    IndexStore.setIncludedArchiveIdentifiers(includedArchiveIdentifiers);
    expect(IndexStore.state.includedArchiveIdentifiers).toEqual(includedArchiveIdentifiers);
  });
});
