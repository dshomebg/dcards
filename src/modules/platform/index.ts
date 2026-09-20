// Barrel на модула `platform` (ARC-2). Навън излиза само каквото е изброено тук.

export {
  type BatchCardDto,
  type BatchDetail,
  type BatchSummary,
  createBatch,
  type CreateBatchInput,
  getBatch,
  getBatchCsvRows,
  listBatches,
  markBatchWritten,
} from './batch.service';
export { type CardRouteRow, findCardForRoute } from './card.repository';
export { CARD_STATUSES, type CardStatus } from './card.schema';
export {
  type AdminCardDto,
  CardError,
  type CardErrorCode,
  detachCardProfile,
  disableCard,
  findCardForAdmin,
} from './card.service';
export {
  activateCard,
  type ActivateCardInput,
  assignCardProfile,
  type CardOrgInput,
  claimCardByCode,
  type ClaimCardInput,
  disableCardByOrg,
  listCardsByOrg,
  type OrgCardDto,
  unassignCardProfile,
} from './card-activation.service';
export { buildCardsCsv, type CardCsvRow } from './card-csv';
export {
  assignCardsFromBatch,
  type AssignCardsFromBatchInput,
  attachOrderCardsToOrg,
  countAvailableCards,
  listCardsByOrder,
  type OrderCardDto,
  releaseOrderCard,
  releaseOrderCards,
} from './card-fulfillment.service';
export {
  ACTIVATION_CODE_PATTERN,
  CARD_ID_ALPHABET,
  CARD_ID_LENGTH,
  type CardGenerator,
  cardIdSchema,
} from './card-id';
export { type CardRoute, resolveCard } from './card-router';
export { cardUrl } from './card-url';
export { LINK_LABELS, linkHref } from './link-href';
export {
  type AdminOrganizationDetail,
  type AdminOrganizationRow,
  type AdminOrgMemberRow,
  countOrganizations,
  createPersonalOrganization,
  findPersonalOrganizationByOwner,
  getOrganizationForAdmin,
  isOrgMember,
  listMembershipsForUsers,
  type PlanUpdate,
  searchOrganizations,
  updateOrganizationPlan,
  type UserMembershipRow,
} from './organization.repository';
export { type Organization, type OrgMember } from './organization.schema';
export {
  listPendingInvitations,
  type PendingInvitationRow,
} from './organization-invitation.repository';
export {
  acceptInvitation,
  type AcceptInvitationResult,
  cancelInvitation,
  createInvitation,
  inspectInvitation,
  type InvitationView,
  type InviteMemberInput,
  type IssuedInvitation,
  resendInvitation,
} from './organization-invitation.service';
export { type InviteMail, inviteMail } from './organization-mail';
export {
  countMembers,
  findMembership,
  listMembers,
  listMembershipsForUser,
  type Membership,
  type MembershipRow,
  type OrgMemberRow,
  removeMember,
  renameOrganization,
} from './organization-member.repository';
export {
  OrganizationError,
  type OrganizationErrorCode,
  PLAN_LABELS,
} from './organization-plan';
export { can, effectivePlan, type Feature } from './plan';
export { findProfilesByOrg } from './profile.repository';
export {
  PROFILE_LINK_TYPES,
  type ProfileLinkType,
  type ProfileTheme,
  type PublicProfile,
  type PublicProfileLink,
} from './profile.schema';
export {
  createProfile,
  findPublicProfileBySlug,
  findPublicProfileRecordBySlug,
  listProfiles,
  ProfileError,
  profileLinkInputSchema,
  profileLinksInputSchema,
  type ProfileSummary,
  type PublicProfileRecord,
  updateProfileInputSchema,
} from './profile.service';
export {
  deleteProfile,
  getProfileForEdit,
  PROFILE_IMAGE_KINDS,
  type ProfileEditDto,
  type ProfileEditLinkDto,
  type ProfileImageKind,
  replaceProfileLinks,
  setProfileImage,
  type SetProfileImageInput,
  updateProfile,
} from './profile-edit.service';
export { profileThemeSchema } from './profile-theme';
export { profileUrl } from './profile-url';
export { renderQrSvg } from './qr';
export { insertScan } from './scan.repository';
export {
  SCAN_DEVICES,
  SCAN_SOURCES,
  type ScanDevice,
  type ScanSource,
} from './scan.schema';
export {
  type FreeScanAnalytics,
  getScanAnalytics,
  type ProScanAnalytics,
  type ScanAnalytics,
} from './scan-analytics.service';
export { type DayCount, localDay } from './scan-days';
export { classifyDevice, isBot } from './scan-device';
export { logScanFailure } from './scan-log';
export { RESERVED_SLUGS, slugSchema } from './slug';
export { type AccentInk, accentInk } from './theme-contrast';
export {
  buildVCard,
  foldLine,
  vcardContentDisposition,
  type VCardOptions,
} from './vcard';
