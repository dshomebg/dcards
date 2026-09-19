// Barrel на модула `auth` (ARC-2). Навън излиза само каквото е изброено тук.

export {
  signIn,
  type SignInFailure,
  signOut,
  type SignOutFailure,
} from './actions';
export { getCurrentAdmin } from './current-admin';
export { getCurrentUser } from './current-user';
export {
  type Admin,
  type RegisterInput,
  registerSchema,
  type SessionUser,
  type SignInInput,
  signInSchema,
} from './schema';
export { type PublicUser } from './user.schema';
export { createUser, findUserByEmail } from './user.service';
export {
  register,
  type RegisterFailure,
  signInUser,
  signOutUser,
} from './user-actions';
