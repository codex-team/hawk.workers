import { ObjectId } from 'mongodb';

export default interface TariffPlan {
  _id: ObjectId;
  name: string;
  monthlyCharge: number;
  eventsLimit: number;
}
