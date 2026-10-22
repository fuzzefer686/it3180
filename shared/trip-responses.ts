import { z } from 'zod';
import { tripStatusSchema } from './contracts';

const stop = z.object({
  id: z.string(), label: z.string(), order: z.number().int().nonnegative(),
  latitude: z.number().finite(), longitude: z.number().finite(),
  distanceFromStartMeters: z.number().nonnegative(),
});
const route = z.object({
  provider: z.literal('VIETMAP'), vehicleType: z.literal('MOTORCYCLE'),
  encodedPolyline: z.string().min(1),
  segments: z.array(z.object({
    fromStopId: z.string(), toStopId: z.string(), distanceMeters: z.number().nonnegative(),
    durationMs: z.number().nonnegative().nullable(), encodedPolyline: z.string().min(1).optional(),
  })).min(1).max(7),
  totalDistanceMeters: z.number().positive(), totalDurationMs: z.number().nonnegative().nullable(),
});
const details = z.object({
  id: z.string(), driverId: z.string(), driverName: z.string(),
  departureTimeMs: z.number(), arrivalTimeMs: z.number().nullable(), status: tripStatusSchema,
  vehicleType: z.literal('MOTORCYCLE'), stops: z.array(stop).min(2).max(8),
  confirmedBookingId: z.string().nullable(), hasServedPassenger: z.boolean(),
  note: z.string(), routeVersion: z.number().int().positive(), route,
  cancellationReason: z.string().nullable(),
});
const trip = z.object({ trip: details });
export const tripResponseSchemas = {
  searchTripPlaces: z.object({ items: z.array(z.object({ refId: z.string(), label: z.string() })) }),
  getTripPlace: z.object({ place: z.object({ label: z.string(), latitude: z.number(), longitude: z.number() }) }),
  previewTripRoute: z.object({ stops: z.array(stop), route }),
  createTrip: trip,
  updateTrip: trip,
  getTrip: trip.extend({ isOwner: z.boolean() }),
  startTrip: trip,
  completeTrip: trip,
  cancelTrip: trip,
  listTrips: z.object({
    items: z.array(z.object({
      id: z.string(), driverName: z.string(), departureTimeMs: z.number(), arrivalTimeMs: z.number().nullable(),
      status: tripStatusSchema, stopLabels: z.array(z.string()), totalDistanceMeters: z.number(),
      hasPassenger: z.boolean(),
    })),
    nextCursor: z.object({ departureTimeMs: z.number(), id: z.string() }).nullable(),
  }),
  getTripSegmentDistance: z.object({ tripId: z.string(), routeVersion: z.number().int(), distanceMeters: z.number().nonnegative() }),
};
