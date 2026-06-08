import React, { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTour, type TourRect } from '@/contexts/tour-context';

/**
 * Wrap any element so the interactive walkthrough can spotlight it. Registers a
 * window-coordinate measure fn under `id`; the tour looks targets up by that id.
 *
 * Keeps layout neutral — pass `style` (e.g. flex:1 for a tab button) so the
 * wrapper doesn't disturb the row it sits in. `collapsable={false}` keeps the
 * native view around on Android so measureInWindow stays valid.
 */
export function TourTarget({
  id,
  children,
  style,
}: {
  id: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View>(null);
  const { register } = useTour();

  useEffect(() => {
    const measure = () =>
      new Promise<TourRect | null>((resolve) => {
        const node = ref.current;
        if (!node) return resolve(null);
        node.measureInWindow((x, y, width, height) => {
          if (!width && !height) resolve(null);
          else resolve({ x, y, width, height });
        });
      });
    return register(id, measure);
  }, [id, register]);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
