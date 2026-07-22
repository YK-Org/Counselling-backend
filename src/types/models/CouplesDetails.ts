// Shared types (migrated to Prisma — see prisma/schema.prisma).
// The deeply-nested personal-history fields below are stored as jsonb columns
// on the Partner table.

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
}
