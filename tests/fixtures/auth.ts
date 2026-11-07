import type { UserProfile } from '../../shared/contracts';

export const profileFixture: UserProfile = {
  uid: '11111111-1111-4111-8111-111111111111', displayName: 'Sinh viên Demo',
  roles: ['USER'], status: 'ACTIVE', studentVerificationStatus: 'VERIFIED',
  phone: '0900000000', school: 'Trường Demo', studentCode: 'DEMO-001',
  studentEvidenceDemo: 'Thẻ hư cấu DEMO-001', studentReviewNote: null,
  driverVerificationStatus: 'VERIFIED', driverReviewNote: null, vehicleModel: null, vehiclePlate: null,
  eligibility: { canBook: true, canDrive: false },
};
export const profileInputFixture = {
  displayName: 'Sinh viên Demo', phone: '0900000000', school: 'Trường Demo',
  studentCode: 'DEMO-001', studentEvidenceDemo: 'Thẻ hư cấu DEMO-001',
  vehicleModel: 'Xe máy Demo', vehiclePlate: 'DEMO-001',
};
