import { useState } from 'react';
import { Icon } from './Icon';

export function ProductImage({ image, name, ...props }) {
  const [loaded, setLoaded] = useState(null);
  const [failed, setFailed] = useState(null);
  return <span className={`product-image ${image && loaded !== image.url ? 'image-loading' : ''}`}>
    {image?.url && failed !== image.url ? <img src={image.url} alt={image.alt || name} width={image.width || 800} height={image.height || 800}
      onLoad={() => setLoaded(image.url)} onError={() => { setFailed(image.url); setLoaded(image.url); }} {...props} />
      : <span className="image-fallback"><Icon name="image" /><span>Photo coming soon</span></span>}
  </span>;
}
