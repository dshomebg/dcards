// Barrel на модула `shop` (ARC-2). Навън излиза само каквото е изброено тук.
// Таблиците НЕ се изнасят; `shop` не внася `@/modules/platform` и обратно.

export {
  addLine,
  type Cart,
  cartCount,
  CartError,
  type CartErrorCode,
  type CartLine,
  type CartLineInput,
  cartLineInputSchema,
  type CartPersonalization,
  cartPersonalizationSchema,
  cartQuantitySchema,
  emptyCart,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  parseCart,
  removeLine,
  updateLineQuantity,
} from './cart';
export {
  type CartLineUnavailableReason,
  type CartView,
  type CartViewLine,
  isVariantActive,
  priceCart,
} from './cart.service';
export {
  formatPrice,
  formatPriceInput,
  parsePriceInput,
  type ParsePriceOptions,
  type PriceFormat,
} from './money';
export {
  type Courier,
  COURIER_LABELS,
  COURIERS,
  ORDER_PHONE_PATTERN,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderCustomer,
  orderCustomerSchema,
  type OrderShipping,
  orderShippingSchema,
  type OrderStatus,
  type OrderSummaryDto,
  type OrderViewDto,
  type OrderViewItemDto,
  type PaymentMethod,
} from './order.schema';
export {
  getOrderForView,
  listOrdersByOrg,
  OrderError,
  type OrderErrorCode,
  type OrderViewQuery,
  type PlacedOrder,
  placeOrder,
  type PlaceOrderInput,
  placeOrderInputSchema,
} from './order.service';
export {
  formatOrderNumber,
  ORDER_NUMBER_PATTERN,
  orderNumberSchema,
} from './order-number';
export {
  PRODUCT_MATERIALS,
  PRODUCT_SLUG_PATTERN,
  type ProductMaterial,
  productSlugSchema,
  type PublicProduct,
  type PublicProductSummary,
  type PublicProductVariant,
} from './product.schema';
export {
  type AdminProductSummary,
  createProduct,
  type CreateProductInput,
  createProductInputSchema,
  getActiveProductBySlug,
  listActiveProducts,
  listProductsForAdmin,
  MAX_PRICE,
  ProductError,
  type ProductErrorCode,
  type ProductFieldsInput,
  productFieldsInputSchema,
  type VariantInput,
  variantInputSchema,
  variantsInputSchema,
} from './product.service';
export {
  deleteProduct,
  getProductForEdit,
  type ProductEditDto,
  type ProductEditVariantDto,
  replaceVariants,
  updateProduct,
} from './product-edit.service';
