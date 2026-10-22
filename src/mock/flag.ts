// Interruptor general de los datos de ejemplo (demos y capturas). Con `false` la app no ejecuta
// nada de src/mock: habla con el backend tal cual. Se decide al levantar la app, desde el .env:
//   EXPO_PUBLIC_MOCKS_ENABLED=true
export const mocksEnabled = process.env.EXPO_PUBLIC_MOCKS_ENABLED === 'true';
