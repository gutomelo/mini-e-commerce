import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentProps, ReactElement } from 'react';

import { cn } from '../lib/utils.js';

export type LabelProps = ComponentProps<typeof LabelPrimitive.Root>;

/**
 * Shadcn-style form label built on Radix's Label primitive, which keeps the
 * `htmlFor`/`id` association accessible without any extra wiring.
 */
export function Label({ className, ...props }: LabelProps): ReactElement {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex select-none items-center gap-2 text-sm leading-none font-medium',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
