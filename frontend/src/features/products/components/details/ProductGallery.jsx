import { useState } from 'react';
import { ProductImage } from '../../../../components/ui/ProductImage';
import { Modal } from '../../../../components/ui/Modal';
import { Icon } from '../../../../components/ui/Icon';

export function ProductGallery({ images, productName }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const selected = images[selectedIndex] || images[0];
  if (!selected) return <div className="detail-photo"><ProductImage name={productName} /></div>;
  return <div className="product-gallery" aria-label={`${productName} photos`}>
    <button type="button" className="detail-photo gallery-zoom" aria-label={`Zoom photo of ${productName}`} onClick={() => setZoomOpen(true)}>
      <ProductImage image={selected} name={productName} />
      <span className="zoom-hint"><Icon name="zoom" />Zoom</span>
    </button>
    <div className="gallery-thumbnails" aria-label="Choose a product photo">
      {images.map((image, index) => <button type="button" key={image.url} aria-label={`Show photo ${index + 1}`}
        aria-pressed={selectedIndex === index} onClick={() => setSelectedIndex(index)}>
        <img src={image.url} alt="" width="72" height="72" />
      </button>)}
      <span className="gallery-caption">{images.length} {images.length === 1 ? 'photo' : 'photos'} · Click image to zoom</span>
    </div>
    <Modal open={zoomOpen} onClose={() => setZoomOpen(false)} label={`${productName} enlarged photo`}>
      <div className="zoom-photo"><ProductImage image={selected} name={productName} /></div>
    </Modal>
  </div>;
}
