/**
 * This source file is part of the Swift.org open source project
 *
 * Copyright (c) 2021 Apple Inc. and the Swift project authors
 * Licensed under Apache License v2.0 with Runtime Library Exception
 *
 * See https://swift.org/LICENSE.txt for license information
 * See https://swift.org/CONTRIBUTORS.txt for Swift project authors
 */

import {
  shallowMount,
  RouterLinkStub,
} from '@vue/test-utils';
import DocumentationNav from 'docc-render/components/DocumentationTopic/DocumentationNav.vue';
import { BreakpointName } from '@/utils/breakpoints';

const {
  Hierarchy,
  NavBase,
} = DocumentationNav.components;

const stubs = {
  'router-link': RouterLinkStub,
  NavBase,
};

const TechnologiesRootIdentifier = 'topic://technologies';

const references = {
  [TechnologiesRootIdentifier]: { kind: 'technologies', url: '/documentation/technologies' },
  'topic://foo': {},
  'topic://bar': {},
};

const mocks = {
  $router: {
    push: jest.fn(),
  },
  $route: {
    query: {},
  },
};

describe('DocumentationNav', () => {
  let wrapper;

  const propsData = {
    title: 'FooKit',
    parentTopicIdentifiers: [
      'topic://foo',
      'topic://bar',
    ],
    currentTopicTags: [{
      type: 'foo',
    }],
    references,
  };

  beforeEach(() => {
    wrapper = shallowMount(DocumentationNav, {
      stubs,
      propsData,
      mocks,
    });
  });

  it('renders a `NavBase` at the root with appropriate attributes', () => {
    const nav = wrapper.find(NavBase);
    expect(nav.exists()).toBe(true);
    expect(nav.attributes('aria-label')).toBe('API Reference');
    expect(nav.classes('nav-hero')).toBe(false);
    expect(nav.classes('theme-dark')).toBe(false);
    expect(nav.classes()).toContain('documentation-nav');
    expect(nav.props()).toHaveProperty('hasSolidBackground', true);
    expect(nav.props()).toHaveProperty('hasNoBorder', false);
    expect(nav.props()).toHaveProperty('hasFullWidthBorder', true);
    expect(nav.props()).toHaveProperty('hasOverlay', false);
    expect(nav.props()).toHaveProperty('breakpoint', BreakpointName.small);
    expect(nav.props()).toHaveProperty('isWideFormat', true);
  });

  it('accepts an isDark prop', () => {
    wrapper.setProps({
      isDark: true,
    });
    const nav = wrapper.find(NavBase);
    expect(nav.classes('theme-dark')).toBe(true);
  });

  it('accepts a hasNoBorder prop', () => {
    wrapper.setProps({
      hasNoBorder: true,
    });
    const nav = wrapper.find(NavBase);
    expect(nav.props()).toHaveProperty('hasNoBorder', true);
  });

  it('renders an inactive link, when no technologies root paths', () => {
    const title = wrapper.find('.nav-title-link');
    expect(title.classes()).toContain('inactive');
    expect(title.is('span')).toBe(true);
    expect(title.text()).toBe('Documentation');
  });

  it('renders the title "Documentation" link, when there is a Technology root', () => {
    wrapper.setProps({
      parentTopicIdentifiers: [
        TechnologiesRootIdentifier,
        ...propsData.parentTopicIdentifiers,
      ],
    });
    const title = wrapper.find('.nav-title-link');
    expect(title.exists()).toBe(true);
    expect(title.is(RouterLinkStub)).toBe(true);
    expect(title.props('to')).toEqual({
      path: references[TechnologiesRootIdentifier].url,
      query: {},
    });
    expect(title.text()).toBe('Documentation');
  });

  it('renders the title "Documentation" link and preservers query params, using the root reference path', () => {
    wrapper = shallowMount(DocumentationNav, {
      stubs,
      propsData: {
        ...propsData,
        parentTopicIdentifiers: [
          TechnologiesRootIdentifier,
          ...propsData.parentTopicIdentifiers,
        ],
      },
      mocks: {
        $route: {
          query: {
            changes: 'latest_minor',
          },
        },
      },
    });
    expect(wrapper.find('.nav-title-link').props('to'))
      .toEqual({
        path: references[TechnologiesRootIdentifier].url,
        query: { changes: 'latest_minor' },
      });
  });

  it('renders a Hierarchy', () => {
    const hierarchy = wrapper.find(Hierarchy);
    expect(hierarchy.exists()).toBe(true);
    expect(hierarchy.props()).toEqual({
      currentTopicTitle: propsData.title,
      parentTopicIdentifiers: propsData.parentTopicIdentifiers,
      isSymbolBeta: false,
      isSymbolDeprecated: false,
      currentTopicTags: propsData.currentTopicTags,
      references,
    });
  });

  it('renders a Hierarchy with correct items, if first hierarchy item is the root link', () => {
    const parentTopicIdentifiers = [
      TechnologiesRootIdentifier,
      ...propsData.parentTopicIdentifiers,
    ];

    wrapper.setProps({ parentTopicIdentifiers });
    const hierarchy = wrapper.find(Hierarchy);
    expect(hierarchy.props())
      // passes all items, without the first one
      .toHaveProperty('parentTopicIdentifiers', parentTopicIdentifiers.slice(1));
  });

  it('exposes a `tray-after` scoped slot', () => {
    let slotProps = null;
    const fooBar = 'Foo bar';
    wrapper = shallowMount(DocumentationNav, {
      stubs,
      propsData,
      mocks,
      scopedSlots: {
        'tray-after': (props) => {
          slotProps = props;
          return fooBar;
        },
      },
    });
    expect(wrapper.text()).toContain(fooBar);
    expect(slotProps).toEqual({
      breadcrumbCount: 3,
    });
  });

  it('exposes a `after-content` slot ', () => {
    const afterContent = 'After Content';
    wrapper = shallowMount(DocumentationNav, {
      stubs,
      propsData,
      mocks,
      slots: {
        'after-content': afterContent,
      },
    });
    expect(wrapper.text()).toContain(afterContent);
  });

  it('exposes a `title` slot', () => {
    let slotProps = null;
    const fooBar = 'Foo bar';
    wrapper = shallowMount(DocumentationNav, {
      stubs,
      propsData,
      mocks,
      scopedSlots: {
        title: (props) => {
          slotProps = props;
          return fooBar;
        },
      },
    });
    expect(wrapper.text()).toContain(fooBar);
    expect(slotProps)
      .toEqual({ inactiveClass: 'inactive', linkClass: 'nav-title-link', rootLink: null });
    expect(wrapper.find('.nav-title-link').exists()).toBe(false);
  });

  it('renders a sidenav toggle', () => {
    wrapper.find('.sidenav-toggle').trigger('click');
    expect(wrapper.emitted('toggle-sidenav')).toBeTruthy();
  });

  it('renders the nav, with `isWideFormat` to `false`', () => {
    wrapper.setProps({
      isWideFormat: false,
    });
    expect(wrapper.find(NavBase).props()).toMatchObject({
      isWideFormat: false,
      breakpoint: BreakpointName.medium,
    });
    expect(wrapper.find('.sidenav-toggle').exists()).toBe(false);
  });
});
