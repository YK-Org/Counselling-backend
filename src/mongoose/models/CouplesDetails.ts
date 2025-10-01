import mongoose, { HydratedDocument, Schema } from "mongoose";
import { ICouples } from "./Couples";

const CouplesDetailsSchemaOptions = {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true,
};

export interface IEducation {
  level: string;
  certificate: string;
}

export interface IProfession {
  type: string;
  placeOfWork: string;
}

export interface IReligion {
  grewUp: string;
  current: string;
  denomination: string;
}

export interface IParents {
  mother: {
    name: string;
    hometown: string;
    profession: IProfession;
  };
  father: {
    name: string;
    hometown: string;
    profession: IProfession;
  };
}

export interface ISiblings {
  numberOfSiblings: string;
  ages: string;
}

export interface IPartner {
  name: string;
  phoneNumber: string;
  dateOfBirth: Date;
  hometown: string;
  orderOfBirth: string;
  education: IEducation;
  profession: IProfession;
  parents: IParents;
  religion: IReligion;
  siblings: ISiblings;
  everDivorced: Boolean;
  reasonForDivorce: string;
  numberOfChildrenWish: string;
  healthStatus: string[];
}

export interface IOtherInfo {
  perceptionAboutSelf: {
    childood: string;
    teens: string;
    now: string;
  };
  hapinessOverYears: {
    childood: string;
    teens: string;
    now: string;
  };
  friendsDuringTeens: {
    boys: string;
    girls: string;
  };
  parentsRelatedBetter: {
    childood: string;
    teens: string;
    now: string;
  };
  parentsAlive: Boolean;
  marriedBefore: Boolean;
  typeOfMarriage: string;
  haveChildren: Boolean;
  numberOfChildrenBefore: string;
  divorceInFamily: Boolean;
  everDivorced: Boolean;
  reasonForDivorce: string;
  meetingPartner: string;
  decisionForMarriage: string;
  situationToDivorce: string;
  parentsConsentMarriage: Boolean;
  marriageTiming: string;
  residenceAfterMarriage: string;
  otherSourceOfIncome: Boolean;
  financialResponsibility: string;
  sexRelationshipMaterials: Boolean;
  sexualAssault: {
    victim: Boolean;
    partnerAware: Boolean;
  };
  abuse: {
    abusedAnyone: Boolean;
    partnerAware: Boolean;
  };
  sexReservations: string;
  fitForProcreation: Boolean;
  helpTalkToPartner: Boolean;
  areasHelpNeeded: string;
  numberOfChildrenWish: string;
  healthStatus: string[];
  marriageSuccess: string;
}

export interface ICouplesDetails {
  name: string;
  phoneNumber: string;
  dateOfBirth: Date;
  gender: string;
  hometown: string;
  education: IEducation;
  profession: IProfession;
  parents: IParents;
  partner: IPartner;
  religion: IReligion;
  churchAfterMarriage: string;
  orderOfBirth: string;
  siblings: ISiblings;
  otherInfo: IOtherInfo;
  couple?: HydratedDocument<ICouples>;
}

const EducationSchema = new Schema<IEducation>({
  level: { type: String },
  certificate: { type: String },
});

const ProfessionSchema = new Schema<IProfession>({
  type: { type: String },
  placeOfWork: { type: String },
});

const ParentsSchema = new Schema<IParents>({
  mother: {
    name: String,
    hometown: String,
    profession: ProfessionSchema,
  },
  father: {
    name: String,
    hometown: String,
    profession: ProfessionSchema,
  },
});

const ReligionSchema = new Schema<IReligion>({
  grewUp: String,
  current: String,
  denomination: String,
});

const SiblingsSchema = new Schema<ISiblings>({
  numberOfSiblings: String,
  ages: String,
});

const PartnerSchema = new Schema<IPartner>({
  name: String,
  phoneNumber: String,
  dateOfBirth: Date,
  hometown: String,
  orderOfBirth: String,
  education: EducationSchema,
  profession: ProfessionSchema,
  parents: ParentsSchema,
  religion: ReligionSchema,
  siblings: SiblingsSchema,
  everDivorced: Boolean,
  reasonForDivorce: String,
  numberOfChildrenWish: String,
  healthStatus: [String],
});

const otherInfoSchema = new Schema<IOtherInfo>({
  perceptionAboutSelf: {
    childood: String,
    teens: String,
    now: String,
  },
  hapinessOverYears: {
    childood: String,
    teens: String,
    now: String,
  },
  friendsDuringTeens: {
    boys: String,
    girls: String,
  },
  parentsRelatedBetter: {
    childood: String,
    teens: String,
    now: String,
  },
  parentsAlive: Boolean,
  marriedBefore: Boolean,
  typeOfMarriage: String,
  haveChildren: Boolean,
  numberOfChildrenBefore: String,
  divorceInFamily: Boolean,
  everDivorced: Boolean,
  reasonForDivorce: String,
  meetingPartner: String,
  decisionForMarriage: String,
  situationToDivorce: String,
  parentsConsentMarriage: Boolean,
  marriageTiming: String,
  residenceAfterMarriage: String,
  otherSourceOfIncome: Boolean,
  financialResponsibility: String,
  sexRelationshipMaterials: Boolean,
  sexualAssault: {
    victim: Boolean,
    partnerAware: Boolean,
  },
  abuse: {
    abusedAnyone: Boolean,
    partnerAware: Boolean,
  },
  sexReservations: String,
  fitForProcreation: Boolean,
  helpTalkToPartner: Boolean,
  areasHelpNeeded: String,
  numberOfChildrenWish: String,
  healthStatus: [String],
  marriageSuccess: String,
});

const CouplesDetailsSchema = new Schema<ICouplesDetails>(
  {
    name: { type: String, required: true },
    phoneNumber: { type: String },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
    hometown: { type: String },
    education: EducationSchema,
    profession: ProfessionSchema,
    parents: ParentsSchema,
    partner: PartnerSchema,
    religion: ReligionSchema,
    churchAfterMarriage: String,
    orderOfBirth: String,
    siblings: SiblingsSchema,
    otherInfo: otherInfoSchema,
  },
  CouplesDetailsSchemaOptions
);

CouplesDetailsSchema.virtual("questionnaire", {
  ref: "Questionnaire",
  localField: "_id",
  foreignField: "partnerId",
});

CouplesDetailsSchema.virtual("couple", {
  ref: "Couples",
  localField: "_id",
  foreignField: "partners",
  justOne: true,
});

export const CouplesDetails = mongoose.model<ICouplesDetails>(
  "CouplesDetails",
  CouplesDetailsSchema
);
