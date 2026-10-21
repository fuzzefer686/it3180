// Google polyline5: đọc vĩ độ trước, trả [kinh độ, vĩ độ] cho bản đồ.
export function decodeTripPolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    const changes: number[] = [];
    for (let axis = 0; axis < 2; axis++) {
      let value = 0;
      let shift = 0;
      let byte = 0;
      do {
        if (index >= encoded.length || shift > 30) {
          throw new Error('Đường vẽ không hợp lệ.');
        }
        byte = encoded.charCodeAt(index) - 63;
        index++;
        if (byte < 0 || byte > 63) throw new Error('Đường vẽ không hợp lệ.');
        value += (byte & 31) * 2 ** shift;
        shift += 5;
      } while (byte >= 32);
      let change = Math.floor(value / 2);
      if (value % 2 === 1) change = -change - 1;
      changes.push(change);
    }
    latitude += changes[0];
    longitude += changes[1];
    if (Math.abs(latitude) > 9000000 || Math.abs(longitude) > 18000000) {
      throw new Error('Tọa độ đường vẽ không hợp lệ.');
    }
    coordinates.push([longitude / 100000, latitude / 100000]);
  }
  if (coordinates.length < 2) throw new Error('Đường vẽ thiếu tọa độ.');
  return coordinates;
}
