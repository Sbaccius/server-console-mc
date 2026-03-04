import upnpy

def test_upnp():
    upnp = upnpy.UPnP()

    print("Discovering UPnP devices...")
    devices = upnp.discover()
    print(f"Found {len(devices)} devices.")

    if len(devices) == 0:
        print("No UPnP devices found.")
        return

    # Usually the first device is the router
    device = devices[0]
    print(f"Using device: {device.friendly_name}")

    service = None
    for s in device.get_services():
        if "WANIPConnection" in s.id or "WANPPPConnection" in s.id:
            service = s
            break
            
    if not service:
        print("Could not find a valid WAN IP/PPP connection service.")
        return

    print(f"Found service: {service.service_id}")
    
    # Check actions
    # AddPortMapping(NewRemoteHost, NewExternalPort, NewProtocol, NewInternalPort, NewInternalClient, NewEnabled, NewPortMappingDescription, NewLeaseDuration)
    try:
        # Just info gathering
        actions = service.get_actions()
        print(f"Available actions: {[a.name for a in actions]}")
        
        # Get external IP
        if "GetExternalIPAddress" in [a.name for a in actions]:
            action = service.get_action("GetExternalIPAddress")
            result = action()
            print(f"External IP Address: {result.get('NewExternalIPAddress')}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_upnp()
