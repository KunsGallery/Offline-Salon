import { expect, test } from '@playwright/test';
import { avatarForSession, normalizeAvatar } from '../src/lib/avatar';

test('animal identity and reusable prop persist while event props follow the salon module', () => {
  const avatar = normalizeAvatar({
    version: 3,
    species: 'dog',
    variant: 'female',
    baseProp: 'pressed-flower',
    moduleProps: { 'pear-play': 'evidence-envelope', 'exhibition-grape': 'grape' },
  });

  expect(avatarForSession(avatar, { enabledModules: ['pear-play'] })).toMatchObject({
    species: 'dog', variant: 'female', baseProp: 'pressed-flower', eventProp: 'evidence-envelope',
  });
  expect(avatarForSession(avatar, { enabledModules: ['exhibition-grape'] })).toMatchObject({
    species: 'dog', variant: 'female', baseProp: 'pressed-flower', eventProp: 'grape',
  });
  expect(avatarForSession(avatar, { enabledModules: [] }).eventProp).toBe('none');
});

test('saved vector characters remain editable without an automatic migration', () => {
  expect(normalizeAvatar({ shape: 'diamond', color: 'moss', expression: 'calm', accessory: 'flower' })).toMatchObject({
    version: 2, shape: 'diamond', color: 'moss', expression: 'calm', accessory: 'flower',
  });
});
