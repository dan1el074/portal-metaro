import { Role } from '../interface/role.interface';

export interface NavigationTool {
  id: number;
  parent: string;
  parentUrl: string;
  title: string;
  url: string;
}

export function getNavigationTools(roles: ReadonlyArray<Role>): NavigationTool[] {
  const tools = roles
    .filter(role => Boolean(role.title && role.titleUrl))
    .map(role => ({
      id: role.id,
      parent: role.parent,
      parentUrl: role.parentUrl,
      title: role.title,
      url: role.parentUrl + role.titleUrl
    }));

  return tools;
}
