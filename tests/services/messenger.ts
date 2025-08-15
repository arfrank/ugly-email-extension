/* eslint-disable @typescript-eslint/dot-notation */
import messengerInstance, { Messenger } from '../../src/services/messenger';

describe('Worker service', () => {
  it('exports instance by default', () => {
    expect(messengerInstance).toBeInstanceOf(Messenger);
  });

  it('sends a message', async () => {
    const postMessage = jest.spyOn(window, 'postMessage');
    jest.spyOn(messengerInstance as any, 'generateUniqueId').mockReturnValue('12345');

    expect(messengerInstance['resolvers']).toMatchObject({});

    const promise = messengerInstance.send('<div></div>');

    expect(messengerInstance['resolvers']['12345']).toBeDefined();

    expect(postMessage).toBeCalledWith({
      id: '12345',
      body: '<div></div>',
      from: 'ugly-email-check',
    }, 'http://localhost');

    // Clean up the promise
    messengerInstance['resolvers']['12345'].resolve(null);
    await promise;
  });
});
