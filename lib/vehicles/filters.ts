// Filter option lists shared by /browse, the homepage search and the homepage
// browse shortcuts, so the values can never drift apart.

export const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "2000", label: "Under £2,000" },
  { value: "2000-5000", label: "£2,000–£5,000" },
  { value: "5000-10000", label: "£5,000–£10,000" },
  { value: "10000-20000", label: "£10,000–£20,000" },
  { value: "over-20000", label: "Over £20,000" },
];

export const FUEL_OPTIONS = [
  { value: "", label: "Any fuel" },
  { value: "Petrol", label: "Petrol" },
  { value: "Diesel", label: "Diesel" },
  { value: "Electric", label: "Electric" },
  { value: "Hybrid", label: "Hybrid" },
];

export const BODY_TYPE_OPTIONS = [
  { value: "", label: "Any body type" },
  { value: "Hatchback", label: "Hatchback" },
  { value: "Saloon", label: "Saloon" },
  { value: "SUV", label: "SUV" },
  { value: "Estate", label: "Estate" },
  { value: "Coupe", label: "Coupe" },
  { value: "Convertible", label: "Convertible" },
  { value: "MPV", label: "MPV" },
  { value: "Van", label: "Van" },
];
