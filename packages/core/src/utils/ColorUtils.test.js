import { describe, it, expect } from 'vitest';
import { hexToRgb, lightenColor, getContrastTextColor, getColorForId, getGroupColor } from './ColorUtils.js';

describe('ColorUtils', () => {
    describe('hexToRgb', () => {
        it('should_parse_6_digit_hex', () => {
            expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
        });
        it('should_parse_3_digit_hex', () => {
            expect(hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0 });
        });
        it('should_return_null_for_invalid', () => {
            expect(hexToRgb('#ZZ')).toBeNull();
        });
    });

    describe('lightenColor', () => {
        it('should_lighten_a_color', () => {
            const result = lightenColor('#000000', 0.5);
            expect(hexToRgb(result)).toEqual({ r: 128, g: 128, b: 128 });
        });
        it('should_return_original_for_invalid_input', () => {
            expect(lightenColor('invalid')).toBe('invalid');
        });
    });

    describe('getContrastTextColor', () => {
        it('should_return_black_for_light_bg', () => {
            expect(getContrastTextColor('#FFFFFF')).toBe('#000000');
        });
        it('should_return_white_for_dark_bg', () => {
            expect(getContrastTextColor('#000000')).toBe('#FFFFFF');
        });
    });

    describe('getColorForId', () => {
        it('should_return_consistent_color_for_same_id', () => {
            const c1 = getColorForId('user-1');
            const c2 = getColorForId('user-1');
            expect(c1).toEqual(c2);
        });
        it('should_return_object_with_light_and_dark', () => {
            const color = getColorForId(1);
            expect(color).toHaveProperty('light');
            expect(color).toHaveProperty('dark');
        });
    });

    describe('getGroupColor', () => {
        it('should_return_null_for_null', () => {
            expect(getGroupColor(null)).toBeNull();
        });
        it('should_return_color_for_valid_id', () => {
            const color = getGroupColor('group-1');
            expect(color).toMatch(/^#[0-9A-F]{6}$/i);
        });
    });
});
