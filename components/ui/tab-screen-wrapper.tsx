import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = { children: React.ReactNode; style?: object };

export function TabScreenWrapper({ children, style }: Props) {
  return (
    <View style={[styles.fill, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
