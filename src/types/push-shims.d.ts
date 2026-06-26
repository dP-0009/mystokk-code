// Ambient shims so the codebase type-checks WITHOUT the native push packages
// installed (they only land in a dev/prod build). Once you run
// `npm install @notifee/react-native @react-native-firebase/app
// @react-native-firebase/messaging`, DELETE this file so the packages' real
// types apply. Only `src/services/push/index.native.ts` references these.

declare module '@react-native-firebase/messaging' {
  const messaging: any;
  export default messaging;
}

declare module '@notifee/react-native' {
  const notifee: any;
  export default notifee;
  export const AndroidImportance: any;
  export const EventType: any;
}
