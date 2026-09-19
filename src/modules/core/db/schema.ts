// Регистърът на Drizzle: вижда всички схеми. Импортът е към ФАЙЛОВЕТЕ със схеми,
// не към barrel-ите — те носят сервизи, които внасят `client.ts`, и се цикли.

export * from '../../auth/user.schema';
export * from '../../platform/organization.schema';
export * from '../../platform/profile.schema';
