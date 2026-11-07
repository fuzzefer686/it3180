import { z } from 'zod';
import { TripError } from './trip-errors.ts';
import type { TripStopInput } from './trips.ts';

export const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const timeSchema = z.number().int().min(0).max(8640000000000000);
const stopSchema = z.object({
  label: z.string().trim().min(1).max(300),
  latitude: z.number().min(8).max(24),
  longitude: z.number().min(102).max(110),
}).strict();
export const stopsSchema = z.array(stopSchema).min(2).max(8);
export const tripInputSchema = z.object({
  stops: stopsSchema,
  departureTimeMs: timeSchema,
  arrivalTimeMs: timeSchema,
  note: z.string().trim().max(1000),
}).strict();
export const updateTripSchema = tripInputSchema.extend({
  tripId: idSchema,
  routeVersion: z.number().int().min(1),
});
export const tripIdSchema = z.object({ tripId: idSchema }).strict();
export const cancelTripSchema = tripIdSchema.extend({
  reason: z.string().trim().min(1).max(500),
});
export const distanceInputSchema = tripIdSchema.extend({
  pickupStopId: idSchema,
  dropoffStopId: idSchema,
});
export const listTripsSchema = z.object({
  origin: z.string().trim().max(120).optional(),
  destination: z.string().trim().max(120).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Ngày không hợp lệ').optional(),
  mine: z.boolean().optional(),
  cursor: z.object({ departureTimeMs: timeSchema, id: idSchema }).strict().optional(),
}).strict();

export function validateStops(stops: TripStopInput[]): void {
  for (let i = 1; i < stops.length; i++) {
    const previous = stops[i - 1];
    const current = stops[i];
    if (previous.latitude === current.latitude && previous.longitude === current.longitude) {
      throw new TripError('INVALID_INPUT', 'Hai điểm dừng liền nhau phải khác vị trí.');
    }
  }
}
export function validateTimes(input: { departureTimeMs: number; arrivalTimeMs: number }): void {
  if (input.departureTimeMs <= Date.now()) {
    throw new TripError('INVALID_INPUT', 'Giờ khởi hành phải ở tương lai.');
  }
  if (input.arrivalTimeMs <= input.departureTimeMs) {
    throw new TripError('INVALID_INPUT', 'Giờ đến dự kiến phải sau giờ khởi hành.');
  }
}
