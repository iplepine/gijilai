import {
  getCenteredWheelScrollTop,
  getCenteredWheelSideSpacerHeight,
  getCenteredWheelValue,
} from "./timeWheel";

describe("timeWheel", () => {
  const options = [0, 5, 10, 15];
  const rowHeight = 44;

  it("uses viewport-relative spacers so selected rows stay centered at any wheel height", () => {
    expect(getCenteredWheelSideSpacerHeight(rowHeight)).toBe(
      "calc(50% - 22px)",
    );
  });

  it("maps option values to row scroll offsets", () => {
    expect(getCenteredWheelScrollTop(10, options, rowHeight)).toBe(88);
    expect(getCenteredWheelScrollTop(30, options, rowHeight)).toBeNull();
  });

  it("maps row scroll offsets back to option values", () => {
    expect(getCenteredWheelValue(0, options, rowHeight)).toBe(0);
    expect(getCenteredWheelValue(87, options, rowHeight)).toBe(10);
    expect(getCenteredWheelValue(1000, options, rowHeight)).toBe(15);
  });
});
