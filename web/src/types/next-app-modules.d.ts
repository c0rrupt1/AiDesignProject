/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "../../app/*" {
  const mod: any;
  export default mod;
  export = mod;
}

declare module "../../app/*/*" {
  const mod: any;
  export default mod;
  export = mod;
}

declare module "../../app/*/*/*" {
  const mod: any;
  export default mod;
  export = mod;
}
