import React from 'react';
import Markdown, { MarkdownProps } from 'react-native-markdown-display';
import { Platform } from 'react-native';

type MarkdownVariant = 'light' | 'dark';

const baseStyles: MarkdownProps['style'] = {
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
  paragraph: {
    marginBottom: 8,
  },
  heading1: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  heading2: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  heading3: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  bullet_list: {
    marginVertical: 8,
  },
  ordered_list: {
    marginVertical: 8,
  },
  list_item: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  bullet_list_icon: {
    color: '#6366F1',
  },
  ordered_list_icon: {
    color: '#6366F1',
  },
  code_inline: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  code_block: {
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fence: {
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  link: {
    color: '#2563EB',
  },
};

const variants: Record<MarkdownVariant, MarkdownProps['style']> = {
  light: {
    body: {
      color: '#F1F5F9',
    },
    strong: {
      color: '#FFFFFF',
    },
    em: {
      color: '#CBD5F5',
    },
    heading1: {
      color: '#F9FAFB',
    },
    heading2: {
      color: '#E5E7EB',
    },
    heading3: {
      color: '#E5E7EB',
    },
    code_inline: {
      color: '#4338CA',
    },
  },
  dark: {
    body: {
      color: '#F8FAFC',
    },
    strong: {
      color: '#FFFFFF',
    },
    em: {
      color: '#C7D2FE',
    },
    heading1: {
      color: '#FFFFFF',
    },
    heading2: {
      color: '#E2E8F0',
    },
    heading3: {
      color: '#E2E8F0',
    },
    code_inline: {
      backgroundColor: 'rgba(148, 163, 184, 0.2)',
      color: '#A5F3FC',
    },
    code_block: {
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
    },
    fence: {
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
    },
    bullet_list_icon: {
      color: '#38BDF8',
    },
    ordered_list_icon: {
      color: '#38BDF8',
    },
  },
};

const composeStyles = (
  variant: MarkdownVariant,
  overrides?: MarkdownProps['style']
): MarkdownProps['style'] => {
  const combined: MarkdownProps['style'] = {};

  Object.keys(baseStyles).forEach((key) => {
    const styleKey = key as keyof MarkdownProps['style'];
    combined[styleKey] = {
      ...(baseStyles[styleKey] || {}),
      ...(variants[variant]?.[styleKey] || {}),
    } as any;
  });

  if (overrides) {
    Object.keys(overrides).forEach((key) => {
      const styleKey = key as keyof MarkdownProps['style'];
      combined[styleKey] = {
        ...(combined[styleKey] || {}),
        ...(overrides[styleKey] || {}),
      } as any;
    });
  }

  return combined;
};

interface MarkdownTextProps {
  content?: string | null;
  variant?: MarkdownVariant;
  styleOverrides?: MarkdownProps['style'];
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ content, variant = 'light', styleOverrides }) => {
  if (!content) {
    return null;
  }

  return <Markdown style={composeStyles(variant, styleOverrides)}>{content}</Markdown>;
};
