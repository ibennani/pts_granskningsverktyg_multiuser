import '@testing-library/jest-dom';
import { expect } from '@jest/globals';
import axeCore from 'jest-axe';

const { toHaveNoViolations } = axeCore;

expect.extend(toHaveNoViolations);
