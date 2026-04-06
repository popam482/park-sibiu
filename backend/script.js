const map = L.map('map').setView([45.7983, 24.1256], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

fetch('../data/parkings.json')
    .then(res => res.json())
    .then(parkings => {
      parkings.forEach(p => {
        L.marker([p.lat, p.lng])
          .addTo(map)
          .bindPopup(`
            <b>${p.name}</b><br>
            Spaces: ${p.freeSpots}/${p.totalSpots}<br>
            Rate: ${p.pricePerHour} RON/hour<br>
            Hours: ${p.openHours}
          `);
      });
    }).catch(err => console.error('Cannot load parking lots:', err));