import { MotionTemplate } from '@/utils/motionTemplates';
import React from 'react';

export interface TemplatePreviewCardProps {
  tmpl: MotionTemplate;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
}

export interface TransitionCardProps {
  transition: {
    name: string;
    color: string;
    preview: string;
  };
  onClick?: () => void;
  isMobile?: boolean;
}
