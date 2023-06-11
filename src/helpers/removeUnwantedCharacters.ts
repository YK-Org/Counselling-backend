export function removeUnwantedCharacters(str: string) {
  const unwantedCharactersRegex = /[ .'?/]/g;
  return str.replace(unwantedCharactersRegex, "");
}
