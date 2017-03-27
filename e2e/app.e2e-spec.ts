import { Angular2SkewtPage } from './app.po';

describe('angular2-skewt App', () => {
  let page: Angular2SkewtPage;

  beforeEach(() => {
    page = new Angular2SkewtPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
