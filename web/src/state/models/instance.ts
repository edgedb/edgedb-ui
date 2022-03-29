import {action, computed, observable, runInAction} from "mobx";
import {
  createContext,
  Model,
  model,
  modelAction,
  objectMap,
  prop,
} from "mobx-keystone";

const serverUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5656"
    : window.location.origin;

@model("InstancePageState")
export class InstancePageState extends Model({}) {
  @observable
  instanceName: string | null = null;

  @observable
  databases: {
    name: string;
  }[] = [];

  async fetchInstanceInfo() {
    const res = await fetch(`${serverUrl}/admin/instance-info`);
    const data = await res.json();

    // console.log(data);

    runInAction(() => {
      this.instanceName = data.instance_name ?? "_localdev";
      this.databases = Object.values(data.databases).map((db: any) => ({
        name: db.name,
      }));
    });
  }

  onInit() {
    this.fetchInstanceInfo();
  }
}
