export class Utils {
  static Capitalize(String: string) {
    const stringToCaptilize = String;
    return stringToCaptilize[0].toUpperCase() + stringToCaptilize.substring(1);
  }
}
