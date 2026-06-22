/**
 * @fileoverview Enhetstester för fokus efter borttagning i modalen Bifoga media.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { resolve_focus_after_removed_item } from '../../js/components/media/attach_media_modal_list_focus.ts';

function build_list_item(with_thumb: boolean, with_remove = true): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'attach-media-filename-list__item';
    if (with_thumb) {
        const thumb = document.createElement('button');
        thumb.type = 'button';
        thumb.className = 'audit-image-card__media-thumb-btn';
        li.appendChild(thumb);
    }
    if (with_remove) {
        const actions = document.createElement('div');
        actions.className = 'attach-media-filename-list__actions';
        const remove = document.createElement('button');
        remove.type = 'button';
        actions.appendChild(remove);
        li.appendChild(actions);
    }
    return li;
}

describe('resolve_focus_after_removed_item', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('fokuserar föregående miniatyr när ett objekt i mitten tas bort', () => {
        const modal = document.createElement('div');
        const list_container = document.createElement('div');
        const ul = document.createElement('ul');
        ul.append(build_list_item(true), build_list_item(true), build_list_item(true));
        list_container.appendChild(ul);
        document.body.append(modal, list_container);

        const target = resolve_focus_after_removed_item(list_container, modal, 1);
        expect(target?.className).toContain('audit-image-card__media-thumb-btn');
        expect(target).toBe(ul.children[0].querySelector('button'));
    });

    it('fokuserar nästa miniatyr när första objekt tas bort', () => {
        const modal = document.createElement('div');
        const list_container = document.createElement('div');
        const ul = document.createElement('ul');
        ul.append(build_list_item(true), build_list_item(true));
        list_container.appendChild(ul);
        document.body.append(modal, list_container);

        const target = resolve_focus_after_removed_item(list_container, modal, 0);
        expect(target).toBe(ul.children[0].querySelector('.audit-image-card__media-thumb-btn'));
    });

    it('fokuserar lägg-till-knappen när listan blir tom', () => {
        const modal = document.createElement('div');
        const choose = document.createElement('button');
        choose.type = 'button';
        choose.className = 'attach-media-choose-file-btn';
        modal.appendChild(choose);
        const list_container = document.createElement('div');
        document.body.append(modal, list_container);

        const target = resolve_focus_after_removed_item(list_container, modal, 0);
        expect(target).toBe(choose);
    });

    it('fokuserar radera-knapp för video utan miniatyr', () => {
        const modal = document.createElement('div');
        const list_container = document.createElement('div');
        const ul = document.createElement('ul');
        ul.append(build_list_item(false), build_list_item(false));
        list_container.appendChild(ul);
        document.body.append(modal, list_container);

        const target = resolve_focus_after_removed_item(list_container, modal, 1);
        expect(target).toBe(ul.children[0].querySelector('.attach-media-filename-list__actions button'));
    });
});
