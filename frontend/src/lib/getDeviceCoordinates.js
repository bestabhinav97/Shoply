export function getDeviceCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location isn’t supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        const messages = {
          1: 'Location permission was denied. You can allow it in your browser settings.',
          2: 'Your device couldn’t determine your location. Please try again.',
          3: 'Finding your location took too long. Please try again.',
        };
        reject(new Error(messages[error.code] || 'Location is unavailable. Please try again.'));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}
