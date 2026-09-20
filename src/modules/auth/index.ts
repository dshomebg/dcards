// Barrel на модула `auth` (ARC-2). Навън излиза само каквото е изброено тук.

export {
  type AccountMail,
  type AccountMailOptions,
  passwordChangedMail,
  verifyEmailMail,
  type VerifyEmailMailOptions,
  welcomeMail,
  type WelcomeMailOptions,
} from './account-mail';
export {
  signIn,
  type SignInFailure,
  signOut,
  type SignOutFailure,
} from './actions';
export { getCurrentAdmin } from './current-admin';
export { getCurrentPublicUser, getCurrentUser } from './current-user';
export { issueVerificationUrl } from './email-verification';
export {
  type Admin,
  type ChangePasswordInput,
  changePasswordInputSchema,
  type RegisterInput,
  registerSchema,
  safeNextPath,
  type SessionUser,
  type SignInInput,
  signInSchema,
} from './schema';
export { revokeOtherSessions } from './session';
export { searchUsers, type SearchUsersInput } from './user.repository';
export { type PublicUser } from './user.schema';
export {
  changePassword,
  type ChangePasswordResult,
  createUser,
  findUserByEmail,
  findUserById,
  verifyEmailByToken,
  type VerifyEmailResult,
} from './user.service';
export {
  register,
  type RegisterFailure,
  signInUser,
  signOutUser,
} from './user-actions';
