export function categoryLink(params, slug) {
  const next = new URLSearchParams(params);
  next.delete("page");
  if (slug) next.set("category", slug);
  else next.delete("category");
  return { pathname: "/products", search: next.toString() };
}

