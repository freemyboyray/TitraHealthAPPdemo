import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LogScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Log</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0EAE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 24, fontWeight: '600', color: '#1A1A1A' },
});
