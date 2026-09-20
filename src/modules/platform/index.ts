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
  createPersonalOrganization,
  findPersonalOrganizationByOwner,
  isOrgMember,
} from './organization.repository';
export { type Organization } from './organization.schema';
export { can, type Feature } from './plan';
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
  listProfiles,
  ProfileError,
  profileLinkInputSchema,
  profileLinksInputSchema,
  type ProfileSummary,
  profileThemeSchema,
  updateProfileInputSchema,
} from './profile.service';
export {
  deleteProfile,
  getProfileForEdit,
  type ProfileEditDto,
  type ProfileEditLinkDto,
  replaceProfileLinks,
  updateProfile,
} from './profile-edit.service';
export { profileUrl } from './profile-url';
export { renderQrSvg } from './qr';
export { insertScan } from './scan.repository';
export {
  SCAN_DEVICES,
  SCAN_SOURCES,
  type ScanDevice,
  type ScanSource,
} from './scan.schema';
export { classifyDevice } from './scan-device';
export { RESERVED_SLUGS, slugSchema } from './slug';
export { buildVCard, vcardContentDisposition } from './vcard';
