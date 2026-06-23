// Typography patch must run before any screen imports `Text` / `TextInput` from react-native.
import './lib/patch-android-text-styles';
import 'expo-router/entry';
