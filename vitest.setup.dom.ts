import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Проектът е с `globals: false`, тоест `@testing-library` НЕ закача почистването
// сам — без този ред вторият тест намира и DOM-а на първия.
afterEach(cleanup);
