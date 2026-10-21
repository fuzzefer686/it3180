import type { RouteStop, Trip } from './contracts.ts';

// Thứ tự điểm dừng do backend tạo, không nhận khoảng cách do client tự tính.
export interface TripStopInput {
  label: string;
  latitude: number;
  longitude: number;
}
export interface SaveTripInput {
  stops: TripStopInput[];
  departureTimeMs: number;
  arrivalTimeMs: number;
  note: string;
}
export interface RouteSegment {
  fromStopId: string;
  toStopId: string;
  distanceMeters: number;
  durationMs: number;
  encodedPolyline: string;
}
export interface RouteSnapshot {
  provider: 'VIETMAP';
  vehicleType: 'MOTORCYCLE';
  segments: RouteSegment[];
  totalDistanceMeters: number;
  totalDurationMs: number;
}
export interface TripDetails extends Trip {
  driverName: string;
  arrivalTimeMs: number;
  note: string;
  routeVersion: number;
  route: RouteSnapshot;
  cancellationReason: string | null;
}
export interface TripListItem {
  id: string;
  driverName: string;
  departureTimeMs: number;
  arrivalTimeMs: number;
  status: Trip['status'];
  stopLabels: string[];
  totalDistanceMeters: number;
  hasPassenger: boolean;
}
export interface TripCursor {
  departureTimeMs: number;
  id: string;
}
export interface ListTripsInput {
  origin?: string;
  destination?: string;
  date?: string;
  mine?: boolean;
  cursor?: TripCursor;
}
export interface PlaceSuggestion {
  refId: string;
  label: string;
}
export interface TripApiContracts {
  searchTripPlaces: { input: { text: string }; output: { items: PlaceSuggestion[] } };
  getTripPlace: { input: { refId: string }; output: { place: TripStopInput } };
  previewTripRoute: {
    input: { stops: TripStopInput[] };
    output: { stops: RouteStop[]; route: RouteSnapshot };
  };
  createTrip: { input: SaveTripInput; output: { trip: TripDetails } };
  updateTrip: {
    input: SaveTripInput & { tripId: string; routeVersion: number };
    output: { trip: TripDetails };
  };
  listTrips: {
    input: ListTripsInput;
    output: { items: TripListItem[]; nextCursor: TripCursor | null };
  };
  getTrip: { input: { tripId: string }; output: { trip: TripDetails; isOwner: boolean } };
  startTrip: { input: { tripId: string }; output: { trip: TripDetails } };
  completeTrip: { input: { tripId: string }; output: { trip: TripDetails } };
  cancelTrip: { input: { tripId: string; reason: string }; output: { trip: TripDetails } };
  getTripSegmentDistance: {
    input: { tripId: string; pickupStopId: string; dropoffStopId: string };
    output: { tripId: string; routeVersion: number; distanceMeters: number };
  };
}
