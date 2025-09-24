import { removeUnwantedCharacters } from "./removeUnwantedCharacters";

const mapData: any = {
  FullName: "name",
  TelNo: "phoneNumber",
  DateofBirth: "dateOfBirth",
  HomeTown: "hometown",
  HighestLevelofEducation: "education.level",
  CertificateObtained: "education.certificate",
  ProfessionOccupation: "profession.type",
  PlaceofWork: "profession.placeOfWork",
  MothersFullName: "parents.mother.name",
  MothersHometown: "parents.mother.hometown",
  MothersProfessionOccupation: "parents.mother.profession.type",
  MothersPlaceofWork: "parents.mother.profession.placeOfWork",
  FathersFullName: "parents.father.name",
  FathersHometown: "parents.father.hometown",
  FathersProfessionOccupation: "parents.father.profession.type",
  FathersPlaceofWork: "parents.father.profession.placeOfWork",
  FullNameofyourpartner: "partner.name",
  TelNoofyourpartner: "partner.phoneNumber",
  DateofBirthofyourpartner: "partner.dateOfBirth",
  Hometownofyourpartner: "partner.hometown",
  HighestLevelofEducationofyourpartner: "partner.education.level",
  CertificateyourpartnerObtained: "partner.education.certificate",
  ProfessionOccupationofyourpartner: "partner.profession.type",
  PlaceofWorkofyourpartner: "partner.profession.placeOfWork",
  FullNameofPartnersFather: "partner.parents.father.name",
  Hometownofpartnersfather: "partner.parents.father.hometown",
  ProfessionOccupationofpartnersfather:
    "partner.parents.father.profession.type",
  PlaceofWorkofpartnersfather: "partner.parents.father.profession.placeOfWork",
  FullNameofPartnersMother: "partner.parents.mother.name",
  Hometownofpartnersmother: "partner.parents.mother.hometown",
  ProfessionOccupationofpartnersmother:
    "partner.parents.mother.profession.type",
  PlaceofWorkofpartnersmother: "partner.parents.mother.profession.placeOfWork",
  Religioninwhichyougrewup: "religion.grewUp",
  CurrentReligion: "religion.current",
  Religioninwhichyourpartnergrewup: "partner.religion.grewUp",
  Partnerscurrentreligion: "partner.religion.current",
  Yourreligiousdenomination: "religion.denomination",
  Partnersreligiousdenomination: "partner.religion.denomination",
  Whichchurchdoyouwishtoattendwhenyoumarry: "churchAfterMarriage",
  Selectwhereyoufallintheorderofbirth: "orderOfBirth",
  Selectwhereyourpartnerfallsintheorderofbirth: "partner.orderOfBirth",
  Howmanysiblingsdoyouhave: "siblings.numberOfSiblings",
  Indicatetheagesofyoursiblingsfromeldesttotheyoungestwiththeirgender:
    "siblings.ages",
  Howmanysiblingsdoesyourpartnerhave:
    "partner.siblings.numberOfSiblings.numberOfSiblings",
  Indicatetheagesofyourpartnerssiblingsfromeldesttotheyoungestwiththeirgender:
    "partner.siblings.ages",
  Whathasbeenyourperceptionaboutyourselfovertheyears:
    "otherInfo.perceptionAboutSelf",
  Howhappyhaveyoubeenovertheyears: "otherInfo.hapinessOverYears",
  "Howmanyfriendsdidyouhaveduringyourteens,especially16and18":
    "otherInfo.friendsDuringTeens",
  Whichofyourparentshaveyourelatedbetterovertheyears:
    "otherInfo.parentsRelatedBetter",
  "Ifyourbiologicalparentsarealive,aretheystillmarried":
    "otherInfo.parentsAlive",
  Haveyoubeenmarriedbefore: "otherInfo.marriedBefore",
  Selectwhattypeofweddingitwas: "otherInfo.typeOfMarriage",
  Doyouhaveanychildren: "otherInfo.haveChildren",
  Statethenumberofchildren: "otherInfo.numberOfChildrenBefore",
  "Tothebestofyourknowledge,doyouhavecasesofdivorceinyourfamilyline":
    "otherInfo.divorceInFamily",
  Haveyoueverdivorced: "otherInfo.everDivorced",
  Ifyesbrieflyexplainthecircumstanceofyourdivorce: "otherInfo.reasonForDivorce",
  Hasyourpartnereverdivorced: "partner.everDivorced",
  Ifyesbrieflyexplainthecircumstanceofyourpartnersdivorce:
    "partner.reasonForDivorce",
  Wherewasthefirsttimeyoumetyourpartnerandunderwhatcircumstance:
    "otherInfo.meetingPartner",
  Whatexactlyledtoyourdecisiontomarryyourpartnerinparticular:
    "otherInfo.decisionForMarriage",
  Underwhatspecificsituationwouldyouliketobeseparatedordivorced:
    "otherInfo.situationToDivorce",
  "Doyourparentsandin-lawstobeconsenttoyourbeingmarried":
    "otherInfo.parentsConsentMarriage",
  Whendoyouintendtomarry: "otherInfo.marriageTiming",
  Wherewillyouandyourpartnerliveaftermarriage:
    "otherInfo.residenceAfterMarriage",
  Doyouhaveanyothersourceofincomeapartfromyourregularsalary:
    "otherInfo.otherSourceOfIncome",
  DoyouhaveanyfinancialresponsibilityTowhomandwhy:
    "otherInfo.financialResponsibility",
  Haveyoureadmaterialsortakenpartincourseswhichhashelpedyoutounderstandsexualrelationship:
    "otherInfo.sexRelationshipMaterials",
  Haveyoueverfallenintoorbecomeavictimofanyformofsexualassault:
    "otherInfo.sexualAssault.victim",
  "Ifyes,isyourpartneraware": "otherInfo.sexualAssault.partnerAware",
  Haveyoueverabusedanyoneoftheoppositesex: "otherInfo.abuse.abusedAnyone",
  "Ifyes,isyourpartnerawareoftheabuse": "otherInfo.abuse.partnerAware",
  "Whatreservation(s)doyouhaveaboutsexualintercourseinmarriage":
    "otherInfo.sexReservations",
  Tothebestyourknowledgeareyoumedicallyandphysicallyfitforprocreation:
    "otherInfo.fitForProcreation",
  Isthereanythingyouwanttobeassistedtocommunicatetoyourpartner:
    "otherInfo.helpTalkToPartner",
  Doyoufeeltheneedforassistanceinanyofthefollowingareas:
    "otherInfo.areasHelpNeeded",
  Howmanychildrendoyouwishtohave: "otherInfo.numberOfChildrenWish",
  Howmanychildrendoesyourpartnerwishtohave: "partner.numberOfChildrenWish",
  Doyouknowyourhealthstatusofthefollowing: "otherInfo.healthStatus",
  Doyouknowthehealthstatusofyourpartner: "partner.healthStatus",
  Howconfidentareyouthatyourmarriagewillwork: "otherInfo.marriageSuccess",
  Gender: "gender",
};

export function transformFormData(data: any) {
  const booleanFields = [
    "partner.everDivorced",
    "otherInfo.parentsAlive",
    "otherInfo.marriedBefore",
    "otherInfo.haveChildren",
    "otherInfo.divorceInFamily",
    "otherInfo.everDivorced",
    "otherInfo.parentsConsentMarriage",
    "otherInfo.otherSourceOfIncome",
    "otherInfo.sexRelationshipMaterials",
    "otherInfo.sexualAssault.victim",
    "otherInfo.sexualAssault.partnerAware",
    "otherInfo.abuse.abusedAnyone",
    "otherInfo.abuse.partnerAware",
    "otherInfo.fitForProcreation",
    "otherInfo.helpTalkToPartner",
  ];

  const newObj: any = {};
  for (let key in data) {
    const formattedKey = removeUnwantedCharacters(key);
    const keyInDb = mapData[formattedKey];

    if (booleanFields.includes(keyInDb)) {
      newObj[keyInDb] = data[key] === "Yes" ? true : false;
    } else {
      let value = data[key];

      switch (keyInDb) {
        case "otherInfo.friendsDuringTeens":
          newObj["otherInfo.friendsDuringTeens.boys"] = value[0];
          newObj["otherInfo.friendsDuringTeens.girls"] = value[1];
          break;
        case "otherInfo.perceptionAboutSelf":
        case "otherInfo.hapinessOverYears":
        case "otherInfo.parentsRelatedBetter":
          newObj[`${keyInDb}.childood`] = value[0];
          newObj[`${keyInDb}.teens`] = value[1];
          newObj[`${keyInDb}.now`] = value[2];
          break;
        case "otherInfo.healthStatus":
        case "partner.healthStatus":
        case "otherInfo.areasHelpNeeded":
          newObj[keyInDb] = value.join(",");
          break;
        case "gender":
          newObj[keyInDb] = value.toLowerCase();
          break;
        default:
          newObj[keyInDb] = value;
          break;
      }
    }
  }

  return newObj;
}
