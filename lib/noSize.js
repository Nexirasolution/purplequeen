// Categories that have no sizes (hasSizes === false) store ONE hidden size
// entry with this name, so stock / cart / checkout keep working unchanged.
export const NO_SIZE = 'One Size';

// True when every variant of the product only has the hidden "One Size" entry.
export function isNoSizeProduct(product) {
  const variants = product?.variants || [];
  if (variants.length === 0) return false;
  return variants.every((v) => {
    const sizes = v.sizes || [];
    return sizes.length === 0 || (sizes.length === 1 && sizes[0].size === NO_SIZE);
  });
}