vi.mock("../../src/client/FriendsChatTransport",()=>({getRoomChatSession:()=>null}));
import { afterEach, expect, test, vi } from "vitest";
vi.mock("../../src/client/Transport", () => ({
  SendAllianceRequestIntentEvent: class {
    constructor(
      public from: unknown,
      public to: unknown,
    ) {}
  },
  SendDonateGoldIntentEvent: class {
    constructor(
      public to: unknown,
      public gold: bigint,
    ) {}
  },
  SendDonateTroopsIntentEvent: class {
    constructor(
      public to: unknown,
      public troops: number,
    ) {}
  },
}));
import { FriendsTactics } from "../../src/client/controllers/FriendsTactics";
let controller: FriendsTactics;
afterEach(() => {
  controller?.onRendererDispose();
  document.body.replaceChildren();
});
test("real controls submit pact/transfers, place a ping and switch to spectator tools", () => {
  process.env.FRIENDS_STATIC = "true";
  let alive = true,
    friendly = false;
  const target = {
    smallID: () => 2,
    isAlive: () => true,
    displayName: () => "Friend",
    name: () => "Friend",
    clientID: () => "friend",
  };
  const me = {
    smallID: () => 1,
    clientID: () => "me",
    isAlive: () => alive,
    numTilesOwned: () => 10,
    isFriendly: () => friendly,
    gold: () => 50000n,
    troops: () => 10000,
    name: () => "Me",
  };
  const emit = vi.fn();
  const game = {
    myPlayer: () => me,
    players: () => [me, target],
    config: () => ({
      gameConfig: () => ({ donateGold: true, donateTroops: true }),
    }),
    width: () => 100,
    height: () => 100,
    ref: (x: number, y: number) => y * 100 + x,
    x: (tile: number) => tile % 100,
    y: (tile: number) => Math.floor(tile / 100),
  };
  controller = new FriendsTactics(
    game as never,
    {
      screenToWorldCoordinates: (x: number, y: number) => ({ x, y }),
      worldToScreenCoordinates: (cell: unknown) => cell,
    } as never,
    { emit } as never,
  );
  controller.init();
  const click = (name: string) => {
    const b = [...document.querySelectorAll(".ft-panel button")].find(
      (b) => b.textContent === name,
    ) as HTMLButtonElement;
    b.click();
  };
  click("Offer temporary pact");
  expect(emit).toHaveBeenCalledTimes(1);
  friendly = true;
  click("Send 10,000 gold");
  expect(emit.mock.calls[1][0].gold).toBe(10000n);
  click("Send 10% troops");
  expect(emit.mock.calls[2][0].troops).toBe(1000);
  click("Attack here");
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  canvas.dispatchEvent(
    new MouseEvent("pointerup", { clientX: 30, clientY: 40, bubbles: true }),
  );
  controller.tick();
  expect(document.querySelector(".ft-map-ping")?.textContent).toContain(
    "attack",
  );
  document.dispatchEvent(new CustomEvent("friends-chat-session",{detail:{session:{uid:"me",party:{members:[{uid:"friend-uid",clientID:"friend"}]}}}}));
  const ping={name:"Friend",uid:"friend-uid",text:"AGPING:"+JSON.stringify({kind:"defend",tile:25,at:Date.now()})};
  friendly=false;document.dispatchEvent(new CustomEvent("friends-map-ping",{detail:ping}));expect(document.querySelectorAll(".ft-map-ping")).toHaveLength(1);
  friendly=true;document.dispatchEvent(new CustomEvent("friends-map-ping",{detail:ping}));expect(document.querySelectorAll(".ft-map-ping")).toHaveLength(2);
  alive = false;
  controller.tick();
  expect(document.querySelector(".ft-panel summary")?.textContent).toContain(
    "Spectating",
  );
  click("Watch selected nation");
  expect(emit).toHaveBeenCalledTimes(4);
});
